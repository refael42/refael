/**
 * The PM's own WhatsApp number in SiteFlow: connect it, see who wrote, and
 * choose whose chats are kept (follow) or never kept (ignore).
 */
import type { WhatsappLink, WhatsappLinkContact } from "../db/types";
import { he } from "../i18n/he";
import type { CoexGraph } from "../whatsapp/coexistence";
import { assertPM } from "./access";
import { AccessError } from "./auth-types";
import { ServiceError, type Ctx } from "./tasks";

export async function connectWhatsapp(ctx: Ctx, graph: CoexGraph, input: { code: string; wabaId: string; phoneNumberId: string }): Promise<WhatsappLink> {
  assertPM(ctx.s);
  const ids = [input.wabaId, input.phoneNumberId];
  if (!input.code || ids.some((x) => !/^\d{5,25}$/.test(x))) throw new ServiceError(he.errors.invalid);
  const taken = await ctx.store.first("whatsapp_links", { where: { phone_number_id: input.phoneNumberId } });
  if (taken && taken.profile_id !== ctx.s.profile.id) throw new ServiceError(he.waLink.taken);
  const token = await graph.exchangeCode(input.code);
  const display = await graph.displayPhone(input.phoneNumberId, token).catch(() => null);
  await graph.subscribe(input.wabaId, token);
  const row = { profile_id: ctx.s.profile.id, waba_id: input.wabaId, phone_number_id: input.phoneNumberId, display_phone: display, access_token: token, status: "connected" as const };
  const [link] = taken ? await ctx.store.update("whatsapp_links", { id: taken.id }, row) : await ctx.store.insert("whatsapp_links", row);
  // contacts first (names for the "who wrote" list), then the history — Meta allows asking once
  try {
    await graph.sync(input.phoneNumberId, token, "smb_app_state_sync");
    if (!link.history_requested_at) {
      await graph.sync(input.phoneNumberId, token, "history");
      await ctx.store.update("whatsapp_links", { id: link.id }, { history_requested_at: (ctx.now ?? new Date()).toISOString() });
    }
  } catch (err) {
    console.warn("[whatsapp] coexistence sync request failed", (err as Error).message);
  }
  return link;
}

async function ownLink(ctx: Ctx): Promise<WhatsappLink | null> {
  return ctx.store.first("whatsapp_links", { where: { profile_id: ctx.s.profile.id } });
}

/** Stop mirroring (what was kept stays; nothing new comes in). */
export async function disconnectWhatsapp(ctx: Ctx) {
  assertPM(ctx.s);
  const link = await ownLink(ctx);
  if (link) await ctx.store.update("whatsapp_links", { id: link.id }, { status: "disconnected" });
}

export interface WhatsappOverview {
  link: Pick<WhatsappLink, "id" | "display_phone" | "status" | "last_message_at" | "history_requested_at"> | null;
  pending: WhatsappLinkContact[];
  followed: Array<WhatsappLinkContact & { projectName: string | null }>;
  ignored: WhatsappLinkContact[];
}

export async function myWhatsapp(ctx: Ctx): Promise<WhatsappOverview> {
  assertPM(ctx.s);
  const link = await ownLink(ctx);
  if (!link) return { link: null, pending: [], followed: [], ignored: [] };
  const contacts = (await ctx.store.select("whatsapp_link_contacts", { where: { link_id: link.id } })).sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));
  const projectIds = [...new Set(contacts.map((c) => c.project_id).filter(Boolean) as string[])];
  const projects = projectIds.length ? await ctx.store.select("projects", { where: { id: { in: projectIds } } }) : [];
  return {
    link: { id: link.id, display_phone: link.display_phone, status: link.status, last_message_at: link.last_message_at, history_requested_at: link.history_requested_at },
    // a name the phone knows but no message yet is not worth asking about
    pending: contacts.filter((c) => c.status === "pending" && c.message_count > 0),
    followed: contacts.filter((c) => c.status === "follow").map((c) => ({ ...c, projectName: projects.find((p) => p.id === c.project_id)?.name ?? null })),
    ignored: contacts.filter((c) => c.status === "ignore"),
  };
}

/**
 * Follow a chat (from now on its messages are kept, in the current project),
 * or ignore it / stop following (nothing more is kept; optionally delete what was).
 */
export async function setWhatsappContact(ctx: Ctx, contactId: string, action: "follow" | "ignore", opts: { deleteKept?: boolean } = {}) {
  assertPM(ctx.s);
  const link = await ownLink(ctx);
  const contact = link ? await ctx.store.byId("whatsapp_link_contacts", contactId) : null;
  if (!link || !contact || contact.link_id !== link.id) throw new AccessError(he.errors.notFound, 404);
  if (action === "follow") {
    await ctx.store.update("whatsapp_link_contacts", { id: contact.id }, { status: "follow", project_id: contact.project_id ?? ctx.s.project.id });
    return;
  }
  await ctx.store.update("whatsapp_link_contacts", { id: contact.id }, { status: "ignore", ...(opts.deleteKept ? { source_ids: [] } : {}) });
  if (opts.deleteKept && contact.source_ids?.length) {
    // only chats in projects this PM manages
    const pm = ctx.s.memberships.filter((m) => m.role === "pm").map((m) => m.project_id);
    const sources = await ctx.store.select("sources", { where: { id: { in: contact.source_ids } } });
    for (const src of sources.filter((x) => pm.includes(x.project_id) && x.kind === "whatsapp_coexistence")) {
      await ctx.store.remove("source_items", { source_id: src.id });
      await ctx.store.remove("sources", { id: src.id });
    }
  }
}
