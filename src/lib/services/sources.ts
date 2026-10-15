/**
 * Project intelligence, step 1 — outside conversations as raw sources.
 *
 * A WhatsApp chat export is parsed in the browser (it can be large) and sent
 * here in chunks of messages. Each message is stored once, exactly as it was
 * written, with who wrote it; later steps turn these items into events.
 */
import type { Profile, Source, SourceItem, SourceItemKind } from "../db/types";
import { he } from "../i18n/he";
import { normalizePhone } from "../phone";
import { assertPM, isPM } from "./access";
import { AccessError } from "./auth-types";
import { ServiceError, type Ctx } from "./tasks";

export interface IncomingMessage {
  key: string;
  sentAt: string;
  author: string;
  text: string;
  kind: Exclude<SourceItemKind, "system">;
  attachment: string | null;
  /** storage key, when the browser uploaded the attached file */
  mediaUrl: string | null;
}

export interface ImportChunk {
  title: string;
  isGroup: boolean;
  /** ISO date; earlier messages are left out */
  since: string | null;
  messages: IncomingMessage[];
}

const MAX_CHUNK = 2000;
const KEY = /^[0-9a-f]{28}-\d+$/;

function assertStaff(ctx: Ctx) {
  if (ctx.s.role !== "pm" && ctx.s.role !== "viewer") throw new AccessError(he.errors.forbidden, 403);
}

async function ownSource(ctx: Ctx, id: string): Promise<Source> {
  const src = await ctx.store.byId("sources", id);
  if (!src || src.project_id !== ctx.s.project.id) throw new AccessError(he.errors.notFound, 404);
  return src;
}

/** People of the project a chat author can be: members' profiles (contractors, PMs, viewers). */
async function projectPeople(ctx: Ctx): Promise<Profile[]> {
  const members = await ctx.store.select("project_members", { where: { project_id: ctx.s.project.id } });
  return members.length ? ctx.store.select("profiles", { where: { id: { in: members.map((m) => m.profile_id) } } }) : [];
}

const words = (s: string) => s.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Guess who an export name is: a phone number → that person; the exact name →
 * that person; a unique first-name match ("פז מיזוג" ~ "פז טכנאי מזגנים") →
 * that person, flagged auto so the PM confirms it.
 */
export function guessSpeaker(author: string, people: Profile[]): { profile_id: string; auto: boolean } | null {
  const phone = normalizePhone(author);
  if (phone && /^[+\d\s()-]+$/.test(author)) {
    const p = people.find((x) => x.phone && normalizePhone(x.phone) === phone);
    return p ? { profile_id: p.id, auto: false } : null;
  }
  const name = words(author).join(" ");
  const exact = people.filter((p) => words(p.full_name).join(" ") === name);
  if (exact.length === 1) return { profile_id: exact[0].id, auto: false };
  const first = words(author)[0];
  if (!first || first.length < 2) return null;
  const byFirst = people.filter((p) => words(p.full_name)[0] === first);
  return byFirst.length === 1 ? { profile_id: byFirst[0].id, auto: true } : null;
}

/** Add one chunk of an exported chat. Re-importing the same chat adds only what is new. */
export async function importChatChunk(ctx: Ctx, input: ImportChunk) {
  assertPM(ctx.s);
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new ServiceError(he.sources.needTitle);
  if (input.messages.length > MAX_CHUNK) throw new ServiceError(he.errors.invalid);
  if (input.messages.some((m) => !KEY.test(m.key) || Number.isNaN(Date.parse(m.sentAt)))) throw new ServiceError(he.errors.invalid);
  if (input.messages.some((m) => m.mediaUrl && !m.mediaUrl.startsWith(`media/${ctx.s.project.id}/`))) throw new ServiceError(he.errors.invalid);

  const now = (ctx.now ?? new Date()).toISOString();
  let src = await ctx.store.first("sources", { where: { project_id: ctx.s.project.id, kind: "whatsapp_export", title } });
  if (!src) {
    [src] = await ctx.store.insert("sources", {
      project_id: ctx.s.project.id,
      kind: "whatsapp_export",
      title,
      is_group: input.isGroup,
      since: input.since,
      created_by: ctx.s.profile.id,
    });
  }

  // who is who: keep the PM's earlier choices, guess the new names
  const speakers = { ...src.speakers };
  const people = await projectPeople(ctx);
  for (const author of new Set(input.messages.map((m) => m.author))) {
    if (speakers[author]) continue;
    const guess = guessSpeaker(author, people);
    speakers[author] = guess ? { profile_id: guess.profile_id, auto: guess.auto } : { profile_id: null };
  }

  const since = input.since ? Date.parse(input.since) : null;
  const existing = new Set((await ctx.store.select("source_items", { where: { source_id: src.id } })).map((i) => i.external_id));
  const notSeen = input.messages.filter((m) => !existing.has(m.key));
  const fresh = notSeen.filter((m) => since === null || Date.parse(m.sentAt) >= since);
  const rows = fresh.map((m) => {
    const who = speakers[m.author];
    return {
      project_id: ctx.s.project.id,
      source_id: src!.id,
      external_id: m.key,
      sent_at: new Date(m.sentAt).toISOString(),
      author: m.author,
      author_profile_id: who?.ignore ? null : who?.profile_id ?? null,
      kind: m.kind,
      text: m.text || null,
      media_url: m.mediaUrl,
      media_name: m.attachment,
      status: who?.ignore ? ("skipped" as const) : ("new" as const),
    };
  });
  for (let i = 0; i < rows.length; i += 500) await ctx.store.insert("source_items", rows.slice(i, i + 500));
  await ctx.store.update("sources", { id: src.id }, { speakers, last_import_at: now, is_group: src.is_group || input.isGroup });

  return {
    sourceId: src.id,
    added: rows.length,
    duplicates: input.messages.length - notSeen.length,
    beforeSince: notSeen.length - fresh.length,
  };
}

/** PM says who an export name is — or that it should be ignored (e.g. the PM's spouse in a group). */
export async function setSpeaker(ctx: Ctx, sourceId: string, author: string, choice: { profileId: string | null; ignore?: boolean }) {
  assertPM(ctx.s);
  const src = await ownSource(ctx, sourceId);
  if (!(author in src.speakers)) throw new AccessError(he.errors.notFound, 404);
  if (choice.profileId) {
    const member = await ctx.store.first("project_members", { where: { project_id: ctx.s.project.id, profile_id: choice.profileId } });
    if (!member) throw new AccessError(he.errors.notFound, 404);
  }
  const ignore = !!choice.ignore;
  await ctx.store.update("sources", { id: src.id }, {
    speakers: { ...src.speakers, [author]: { profile_id: ignore ? null : choice.profileId, ...(ignore ? { ignore: true } : {}) } },
  });
  const items = await ctx.store.select("source_items", { where: { source_id: src.id, author } });
  for (const it of items) {
    // processed items keep their status; ignoring only parks what was not handled yet
    const status = it.status === "processed" ? it.status : ignore ? "skipped" : it.status === "skipped" ? "new" : it.status;
    await ctx.store.update("source_items", { id: it.id }, { author_profile_id: ignore ? null : choice.profileId, status });
  }
}

export async function deleteSource(ctx: Ctx, sourceId: string) {
  assertPM(ctx.s);
  const src = await ownSource(ctx, sourceId);
  await ctx.store.remove("source_items", { source_id: src.id });
  await ctx.store.remove("sources", { id: src.id });
}

export interface SourceListItem {
  id: string;
  title: string;
  isGroup: boolean;
  messages: number;
  waiting: number;
  unknownSpeakers: number;
  lastImportAt: string | null;
  lastMessageAt: string | null;
}

export async function listSources(ctx: Ctx): Promise<SourceListItem[]> {
  assertStaff(ctx);
  const sources = await ctx.store.select("sources", { where: { project_id: ctx.s.project.id }, order: [["created_at", "desc"]] });
  if (!sources.length) return [];
  const items = await ctx.store.select("source_items", { where: { source_id: { in: sources.map((s) => s.id) } } });
  return sources.map((s) => {
    const mine = items.filter((i) => i.source_id === s.id);
    return {
      id: s.id,
      title: s.title,
      isGroup: s.is_group,
      messages: mine.length,
      waiting: mine.filter((i) => i.status === "new").length,
      unknownSpeakers: Object.values(s.speakers).filter((v) => !v.ignore && (!v.profile_id || v.auto)).length,
      lastImportAt: s.last_import_at,
      lastMessageAt: mine.reduce<string | null>((max, i) => (!max || i.sent_at > max ? i.sent_at : max), null),
    };
  });
}

export interface SourceDetail {
  source: Source;
  speakers: Array<{ author: string; profileId: string | null; ignore: boolean; auto: boolean; count: number }>;
  items: SourceItem[];
  total: number;
  /** messages not read into events yet */
  waiting: number;
  people: Array<{ id: string; name: string }>;
  canEdit: boolean;
}

export async function sourceDetail(ctx: Ctx, sourceId: string, limit = 200): Promise<SourceDetail> {
  assertStaff(ctx);
  const source = await ownSource(ctx, sourceId);
  const items = await ctx.store.select("source_items", { where: { source_id: source.id }, order: [["sent_at", "desc"]] });
  const people = await projectPeople(ctx);
  return {
    source,
    speakers: Object.entries(source.speakers)
      .map(([author, v]) => ({ author, profileId: v.profile_id, ignore: !!v.ignore, auto: !!v.auto, count: items.filter((i) => i.author === author).length }))
      .sort((a, b) => b.count - a.count),
    items: items.slice(0, limit),
    total: items.length,
    waiting: items.filter((i) => i.status === "new").length,
    people: people.map((p) => ({ id: p.id, name: p.full_name })).sort((a, b) => a.name.localeCompare(b.name, "he")),
    canEdit: isPM(ctx.s),
  };
}
