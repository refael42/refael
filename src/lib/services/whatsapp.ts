/**
 * WhatsApp as the contractor's interface (Meta Cloud API).
 *
 * Out: every message in a contractor's 1:1 chat with the PM — the PM's own
 *      words, task released / assigned, photo requests, approvals, the
 *      morning digest — is relayed to the contractor's WhatsApp.
 * In:  what the contractor writes back lands in that same chat as if typed in
 *      the app, so it goes through the usual AI suggestion → PM approval path.
 *      A photo sent after "סיימתי" (when the system asked for one) becomes the
 *      completion report.
 */
import type { Store } from "../db/store";
import type { Message, Profile, Project } from "../db/types";
import { he } from "../i18n/he";
import { getWaClient, type WaClient } from "../whatsapp/client";
import { analyzeMessage } from "./ai-suggestions";
import type { ProjectSession } from "./auth-types";
import { sendMessage } from "./chat";
import { submitReport } from "./completion";
import { directConversation, projectPMs } from "./messaging";
import type { Ctx } from "./tasks";

const WINDOW_MS = 24 * 3600_000 - 10 * 60_000; // Meta's 24h window, with a safety margin
const PHOTO_REQUEST_DAYS = 7;
const REPORT_APPEND_MS = 30 * 60_000; // more photos right after the first join the same report

function windowOpen(p: Profile, now: Date) {
  return Boolean(p.wa_last_inbound_at && now.getTime() - new Date(p.wa_last_inbound_at).getTime() < WINDOW_MS);
}

// ───────────────────────── out ─────────────────────────

export interface RelayDeps {
  client?: WaClient | null;
  /** a URL Meta can fetch the media from (signed, short-lived) */
  mediaUrl?: (key: string) => Promise<string | null>;
  now?: Date;
}

/** Relay one stored chat message to the contractor(s) in that 1:1 chat. */
export async function relayToWhatsapp(store: Store, msg: Message, deps: RelayDeps = {}) {
  const client = deps.client === undefined ? getWaClient() : deps.client;
  if (!client) return;
  const conv = await store.byId("conversations", msg.conversation_id);
  if (!conv || conv.type !== "direct") return;
  const parts = await store.select("conversation_participants", { where: { conversation_id: conv.id } });
  const others = parts.map((p) => p.profile_id).filter((id) => id !== msg.sender_profile_id);
  if (!others.length) return;
  const members = await store.select("project_members", { where: { project_id: msg.project_id, profile_id: { in: others } } });
  const targets = members.filter((m) => m.role === "contractor").map((m) => m.profile_id);
  if (!targets.length) return;

  const sender = msg.sender_profile_id ? await store.byId("profiles", msg.sender_profile_id) : null;
  const body = msg.text?.trim() ?? "";
  const text = sender ? `${sender.full_name}: ${body}` : body;
  const media = msg.media_url && msg.kind !== "text" && msg.kind !== "system" ? msg.media_url : null;
  const mediaType = msg.kind === "voice" ? "audio" : msg.kind === "file" ? "document" : "image";
  const now = deps.now ?? new Date();

  for (const id of targets) {
    const p = await store.byId("profiles", id);
    if (!p?.phone || p.wa_opt_out) continue;
    try {
      if (!windowOpen(p, now)) {
        // outside the 24h window only the approved template may be sent
        await client.sendTemplate(p.phone, media ? `${sender?.full_name ?? "SiteFlow"}: ${he.wa.mediaWaiting} ${body}`.trim() : text);
        continue;
      }
      const url = media ? await (deps.mediaUrl ?? signedMediaUrl)(media) : null;
      if (url) await client.sendMedia(p.phone, mediaType, url, sender ? `${sender.full_name}${body ? `: ${body}` : ""}` : body || null);
      else if (text) await client.sendText(p.phone, text);
    } catch (err) {
      console.warn("[whatsapp] send failed", (err as Error).message);
    }
  }
}

async function signedMediaUrl(key: string): Promise<string | null> {
  const { resolveFile } = await import("../storage");
  const r = await resolveFile(key);
  return r && "url" in r ? r.url : null;
}

// ───────────────────────── in ─────────────────────────

/** The part of Meta's webhook payload we read. */
export interface WaWebhook {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: WaInboundMessage[];
      };
    }>;
  }>;
}

export interface WaInboundMessage {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
  document?: { id: string; caption?: string; mime_type?: string; filename?: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}

export interface InboundDeps {
  client: WaClient;
  saveMedia: (projectId: string, bytes: Buffer, mime: string) => Promise<string>;
  now?: Date;
}

const STOP = /^\s*(הסר|הסרה|עצור|stop|unsubscribe)\s*$/i;
const START = /^\s*(הצטרף|הפעל|start)\s*$/i;

export async function handleWebhook(store: Store, payload: WaWebhook, deps: InboundDeps): Promise<number> {
  let handled = 0;
  for (const entry of payload.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const m of change.value?.messages ?? []) {
        try {
          if (await handleMessage(store, m, deps)) handled++;
        } catch (err) {
          console.error("[whatsapp] inbound failed", m.id, err);
        }
      }
  return handled;
}

async function handleMessage(store: Store, m: WaInboundMessage, deps: InboundDeps): Promise<boolean> {
  // Meta retries deliveries: handle each message id once
  if (await store.first("wa_inbound", { where: { id: m.id } })) return false;
  try {
    await store.insert("wa_inbound", { id: m.id, from_phone: m.from });
  } catch {
    return false; // a parallel delivery got it first
  }

  const phone = `+${m.from.replace(/\D/g, "")}`;
  const profile = await store.first("profiles", { where: { phone } });
  if (!profile) {
    await deps.client.sendText(phone, he.wa.unknown);
    return true;
  }
  const now = deps.now ?? new Date();
  await store.update("profiles", { id: profile.id }, { wa_last_inbound_at: now.toISOString() });

  const text = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "").trim();
  if (text && STOP.test(text)) {
    await store.update("profiles", { id: profile.id }, { wa_opt_out: true });
    await deps.client.sendText(phone, he.wa.stopped);
    return true;
  }
  if (text && START.test(text)) {
    await store.update("profiles", { id: profile.id }, { wa_opt_out: false });
    await deps.client.sendText(phone, he.wa.started);
    return true;
  }

  const ctx = await contractorCtx(store, profile, now);
  if (!ctx) {
    await deps.client.sendText(phone, he.wa.noProject);
    return true;
  }
  // WhatsApp is the contractors' channel; staff use the app
  if (ctx.s.role !== "contractor") {
    await deps.client.sendText(phone, he.wa.staffUseApp);
    return true;
  }
  const [pm] = await projectPMs(store, ctx.s.project.id);
  if (!pm) return true;
  const conversationId = await directConversation(store, ctx.s.project.id, pm, profile.id);

  const caption = m.image?.caption ?? m.document?.caption ?? "";
  const words = text || caption.trim();
  if (words) {
    const msg = await sendMessage(ctx, conversationId, { text: words });
    await markVia(store, msg);
    await analyzeMessage(store, msg.id, { now });
  }

  const media = m.image ?? m.audio ?? m.document;
  if (media) {
    const { bytes, mime } = await deps.client.fetchMedia(media.id);
    let key: string;
    try {
      key = await deps.saveMedia(ctx.s.project.id, bytes, mime);
    } catch {
      await deps.client.sendText(phone, he.wa.unsupported);
      return true;
    }
    if (m.image && (await photoAsReport(ctx, conversationId, key, caption, now))) return true;
    const kind = m.audio ? "voice" : m.document ? "file" : "image";
    const msg = await sendMessage(ctx, conversationId, { kind, mediaUrl: key });
    await markVia(store, msg);
  } else if (!words) {
    await deps.client.sendText(phone, he.wa.unsupported);
  }
  return true;
}

async function markVia(store: Store, msg: Message) {
  await store.update("messages", { id: msg.id }, { meta: { ...(msg.meta ?? {}), via: "whatsapp" } });
}

/** The contractor acting in his (most recently active) project, as if logged in. */
async function contractorCtx(store: Store, profile: Profile, now: Date): Promise<Ctx | null> {
  const memberships = await store.select("project_members", { where: { profile_id: profile.id } });
  if (!memberships.length) return null;
  // prefer a contractor membership (the same person can be staff in another project)
  let membership = memberships.find((x) => x.role === "contractor") ?? memberships[0];
  const contractorProjects = memberships.filter((x) => x.role === "contractor");
  if (contractorProjects.length > 1) {
    const recent = await store.select("notifications", {
      where: { profile_id: profile.id, project_id: { in: contractorProjects.map((x) => x.project_id) } },
      order: [["created_at", "desc"]],
      limit: 1,
    });
    membership = contractorProjects.find((x) => x.project_id === recent[0]?.project_id) ?? membership;
  }
  const project = (await store.byId("projects", membership.project_id)) as Project | null;
  if (!project) return null;
  const contractors = await store.select("contractors", { where: { profile_id: profile.id } });
  const s: ProjectSession = { profile, memberships, project, role: membership.role, contractorIds: contractors.map((c) => c.id), isDemo: false };
  return { store, s, now };
}

/**
 * The system asked this contractor for a photo of a finished task (he wrote
 * "סיימתי") → the photo is the completion report. Further photos sent right
 * after join that report.
 */
async function photoAsReport(ctx: Ctx, conversationId: string, key: string, caption: string, now: Date): Promise<boolean> {
  const { store, s } = ctx;
  const recent = await store.select("messages", {
    where: { conversation_id: conversationId, kind: "system" },
    order: [["created_at", "desc"]],
    limit: 30,
  });
  const since = now.getTime() - PHOTO_REQUEST_DAYS * 24 * 3600_000;
  for (const r of recent) {
    if (r.meta?.action !== "request_photo" || r.meta.for_profile_id !== s.profile.id) continue;
    if (new Date(r.created_at).getTime() < since) break;
    const task = r.meta.task_id ? await store.byId("tasks", r.meta.task_id) : null;
    if (!task || !s.contractorIds.includes(task.contractor_id ?? "")) continue;
    const pending = await store.first("completion_reports", { where: { task_id: task.id, status: "pending" } });
    if (pending) {
      if (pending.submitted_by !== s.profile.id || now.getTime() - new Date(pending.created_at).getTime() > REPORT_APPEND_MS) continue;
      await store.update("completion_reports", { id: pending.id }, { photo_urls: [...pending.photo_urls, key] });
      const msg = await sendMessage(ctx, conversationId, { kind: "image", mediaUrl: key });
      await store.update("messages", { id: msg.id }, { meta: { task_id: task.id, via: "whatsapp" } });
      return true;
    }
    if (task.status === "done") continue;
    await submitReport(ctx, {
      taskId: task.id,
      photoKeys: [key],
      note: caption || null,
      sourceMessageId: typeof r.meta.source_message_id === "string" ? r.meta.source_message_id : null,
    });
    return true;
  }
  return false;
}
