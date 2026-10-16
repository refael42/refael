/**
 * A PM's own WhatsApp Business number mirrored into SiteFlow ("Coexistence").
 *
 * Meta sends us everything that number receives (messages), sends from the
 * app (smb_message_echoes) and, once, its history. We keep only chats with
 * people the PM follows: anyone who is a member of one of his projects is
 * followed automatically; an unknown number is only counted ("052… sent 3
 * messages — follow?") and its content is dropped on arrival. Kept messages
 * become the same raw evidence as an exported chat and are read into updates
 * that wait for the PM's approval.
 */
import type { Store } from "../db/store";
import type { Profile, Project, SourceItemKind, WhatsappLink, WhatsappLinkContact } from "../db/types";
import { he } from "../i18n/he";
import type { ProjectSession } from "./auth-types";
import { processSource } from "./intel";
import type { Ctx } from "./tasks";
import type { WaWebhook } from "./whatsapp";

/** One message on the mirrored number, either side. */
export interface MirrorMessage {
  id: string;
  at: string;
  /** the other side's number, digits only */
  counterpart: string;
  /** sent by the PM (from the WhatsApp Business app), not to him */
  fromBusiness: boolean;
  kind: SourceItemKind;
  text: string;
}

export interface MirrorBatch {
  phoneNumberId: string;
  messages: MirrorMessage[];
  /** names the number knows (from contacts sync or message headers) */
  contacts: Array<{ waId: string; name: string }>;
}

type Raw = Record<string, unknown> & { id?: string; from?: string; to?: string; timestamp?: string; type?: string };

const digits = (x: unknown) => String(x ?? "").replace(/\D/g, "");

/** What a message says, in a line: text, a caption, or what kind of attachment it was. */
function contentOf(m: Raw): { kind: SourceItemKind; text: string } | null {
  const part = (k: string) => (m[k] ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  switch (m.type) {
    case "text":
      return { kind: "text", text: str(part("text").body) };
    case "image":
      return { kind: "image", text: str(part("image").caption) || he.waMirror.image };
    case "video":
      return { kind: "file", text: str(part("video").caption) || he.waMirror.video };
    case "audio":
      return { kind: "voice", text: he.waMirror.voice };
    case "document":
      return { kind: "file", text: str(part("document").caption) || str(part("document").filename) || he.waMirror.file };
    case "location":
      return { kind: "text", text: he.waMirror.location };
    case "button":
      return { kind: "text", text: str(part("button").text) };
    case "interactive": {
      const i = part("interactive") as { button_reply?: { title?: string }; list_reply?: { title?: string } };
      return { kind: "text", text: str(i.button_reply?.title ?? i.list_reply?.title) };
    }
    default:
      // reactions, stickers, edits, system notices: not site updates
      return null;
  }
}

function toMessage(m: Raw, counterpart: string, fromBusiness: boolean): MirrorMessage | null {
  const c = contentOf(m);
  if (!m.id || !counterpart || !c || !c.text) return null;
  const ts = Number(m.timestamp);
  return { id: m.id, at: new Date(Number.isFinite(ts) && ts > 0 ? ts * 1000 : Date.now()).toISOString(), counterpart, fromBusiness, ...c };
}

/**
 * Split a webhook delivery: what belongs to a mirrored PM number (batches)
 * and what is for the SiteFlow number itself (rest — handled as before).
 */
export function splitMirror(payload: WaWebhook, linked: Set<string>): { batches: MirrorBatch[]; rest: WaWebhook } {
  const batches = new Map<string, MirrorBatch>();
  const rest: WaWebhook = { ...payload, entry: [] };
  for (const entry of payload.entry ?? []) {
    const keep: NonNullable<NonNullable<WaWebhook["entry"]>[number]["changes"]> = [];
    for (const change of entry.changes ?? []) {
      const value = (change.value ?? {}) as Record<string, unknown> & { metadata?: { phone_number_id?: string; display_phone_number?: string } };
      const pid = value.metadata?.phone_number_id;
      if (!pid || !linked.has(pid)) {
        keep.push(change);
        continue;
      }
      const b = batches.get(pid) ?? { phoneNumberId: pid, messages: [], contacts: [] };
      batches.set(pid, b);
      const own = digits(value.metadata?.display_phone_number);
      const field = (change as { field?: string }).field ?? "messages";
      if (field === "messages") {
        for (const c of (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }> | undefined) ?? [])
          if (c.wa_id && c.profile?.name) b.contacts.push({ waId: digits(c.wa_id), name: c.profile.name });
        for (const m of (value.messages as Raw[] | undefined) ?? []) {
          const msg = toMessage(m, digits(m.from), false);
          if (msg) b.messages.push(msg);
        }
      } else if (field === "smb_message_echoes") {
        for (const m of (value.message_echoes as Raw[] | undefined) ?? []) {
          const msg = toMessage(m, digits(m.to), true);
          if (msg) b.messages.push(msg);
        }
      } else if (field === "history") {
        for (const chunk of (value.history as Array<{ threads?: Array<{ id?: string; messages?: Raw[] }> }> | undefined) ?? [])
          for (const thread of chunk.threads ?? []) {
            const other = digits(thread.id);
            for (const m of thread.messages ?? []) {
              const mine = (!!m.to && digits(m.to) === other) || (!!own && digits(m.from) === own) || (!!m.from && digits(m.from) !== other);
              const msg = toMessage(m, other, mine);
              if (msg) b.messages.push(msg);
            }
          }
      } else if (field === "smb_app_state_sync") {
        for (const s of (value.state_sync as Array<{ contact?: { full_name?: string; first_name?: string; phone_number?: string } }> | undefined) ?? []) {
          const name = s.contact?.full_name || s.contact?.first_name;
          if (s.contact?.phone_number && name) b.contacts.push({ waId: digits(s.contact.phone_number), name });
        }
      }
      // statuses and anything else on a mirrored number: nothing to keep
    }
    if (keep.length) rest.entry!.push({ ...entry, changes: keep });
  }
  return { batches: [...batches.values()], rest };
}

async function contactFor(store: Store, link: WhatsappLink, waId: string): Promise<WhatsappLinkContact> {
  const found = await store.first("whatsapp_link_contacts", { where: { link_id: link.id, wa_id: waId } });
  if (found) return found;
  try {
    return (await store.insert("whatsapp_link_contacts", { link_id: link.id, wa_id: waId }))[0];
  } catch {
    // a parallel delivery created it first
    return (await store.first("whatsapp_link_contacts", { where: { link_id: link.id, wa_id: waId } }))!;
  }
}

function pmCtx(store: Store, owner: Profile, memberships: ProjectSession["memberships"], project: Project, now: Date): Ctx {
  return { store, s: { profile: owner, memberships, project, role: "pm", contractorIds: [], isDemo: false }, now };
}

/** Keep the followed part of one delivery for a mirrored number, then read it into updates. */
export async function handleMirror(store: Store, batch: MirrorBatch, now = new Date()): Promise<{ kept: number; dropped: number }> {
  const link = await store.first("whatsapp_links", { where: { phone_number_id: batch.phoneNumberId } });
  if (!link || link.status !== "connected") return { kept: 0, dropped: batch.messages.length };
  const owner = await store.byId("profiles", link.profile_id);
  if (!owner) return { kept: 0, dropped: batch.messages.length };
  const memberships = await store.select("project_members", { where: { profile_id: owner.id } });
  const pmProjectIds = memberships.filter((m) => m.role === "pm").map((m) => m.project_id);

  for (const c of batch.contacts) {
    const row = await contactFor(store, link, c.waId);
    if (!row.name) await store.update("whatsapp_link_contacts", { id: row.id }, { name: c.name.slice(0, 120) });
  }

  let kept = 0;
  let dropped = 0;
  const touched = new Map<string, string>(); // source id → project id
  const byOther = new Map<string, MirrorMessage[]>();
  for (const m of batch.messages) byOther.set(m.counterpart, [...(byOther.get(m.counterpart) ?? []), m]);

  for (const [waId, msgs] of byOther) {
    let contact = await contactFor(store, link, waId);
    if (contact.status === "ignore") {
      dropped += msgs.length;
      continue;
    }
    // a member of one of the PM's projects is followed without asking
    const person = await store.first("profiles", { where: { phone: `+${waId}` } });
    const projects = person
      ? (await store.select("project_members", { where: { profile_id: person.id } })).map((m) => m.project_id).filter((id) => pmProjectIds.includes(id))
      : [];
    if (!projects.length && contact.status === "follow" && contact.project_id && pmProjectIds.includes(contact.project_id)) projects.push(contact.project_id);
    const last = msgs.reduce((a, m) => (m.at > a ? m.at : a), contact.last_at ?? "");
    if (!projects.length) {
      // not followed (yet): count it, keep nothing of what it says
      await store.update("whatsapp_link_contacts", { id: contact.id }, { message_count: contact.message_count + msgs.length, last_at: last || null });
      dropped += msgs.length;
      continue;
    }
    if (contact.status === "pending") [contact] = await store.update("whatsapp_link_contacts", { id: contact.id }, { status: "follow" });

    const otherName = person?.full_name || contact.name || `+${waId}`;
    const sourceIds = new Set(contact.source_ids ?? []);
    for (const projectId of projects) {
      const title = `${otherName} · ${he.waMirror.sourceSuffix}`;
      let src = await store.first("sources", { where: { project_id: projectId, kind: "whatsapp_coexistence", title } });
      if (!src)
        [src] = await store.insert("sources", {
          project_id: projectId,
          kind: "whatsapp_coexistence",
          title,
          is_group: false,
          speakers: { [owner.full_name]: { profile_id: owner.id }, [otherName]: { profile_id: person?.id ?? null } },
          created_by: owner.id,
        });
      sourceIds.add(src.id);
      for (const m of msgs) {
        try {
          await store.insert("source_items", {
            project_id: projectId,
            source_id: src.id,
            external_id: m.id,
            sent_at: m.at,
            author: m.fromBusiness ? owner.full_name : otherName,
            author_profile_id: m.fromBusiness ? owner.id : person?.id ?? null,
            kind: m.kind,
            text: m.text.slice(0, 4000),
            media_url: null,
            media_name: null,
            status: "new",
          });
          kept++;
        } catch {
          // Meta re-delivers: the same message id is kept once
        }
      }
      await store.update("sources", { id: src.id }, { last_import_at: now.toISOString() });
      touched.set(src.id, projectId);
    }
    await store.update("whatsapp_link_contacts", { id: contact.id }, { message_count: contact.message_count + msgs.length, last_at: last || null, source_ids: [...sourceIds] });
  }
  await store.update("whatsapp_links", { id: link.id }, { last_message_at: now.toISOString() });

  // read what came in now, for free; the updates wait for the PM
  for (const [sourceId, projectId] of touched) {
    const project = await store.byId("projects", projectId);
    if (!project) continue;
    const ctx = pmCtx(store, owner, memberships, project, now);
    for (let i = 0; i < 20; i++) {
      const r = await processSource(ctx, sourceId);
      if (!r.remaining || !r.processed) break;
    }
  }
  return { kept, dropped };
}
