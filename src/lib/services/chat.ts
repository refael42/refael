/**
 * Engine 2 (transport) — conversations, messages, read receipts.
 * AI parsing of new messages lives in services/ai-suggestions.ts.
 */
import type { Store } from "../db/store";
import type { AiParsedJson, AiStatus, Conversation, Message, MessageKind, MessageMeta } from "../db/types";
import { t } from "../i18n";
import { canSeeConversation, isPM } from "./access";
import { AccessError, type ProjectSession } from "./auth-types";
import { directConversation, relayMessage } from "./messaging";
import type { Ctx } from "./tasks";

export interface ConversationListItem {
  id: string;
  type: Conversation["type"];
  title: string;
  subtitle: string | null;
  lastText: string;
  lastAt: string | null;
  unread: number;
  participants: number;
  /** pending AI suggestions in this conversation (PM only) */
  pendingAi: number;
}

export interface MessageVM {
  id: string;
  kind: MessageKind;
  text: string | null;
  mediaUrl: string | null;
  createdAt: string;
  senderId: string | null;
  senderName: string;
  mine: boolean;
  /** all other participants have read it */
  readByAll: boolean;
  aiStatus: AiStatus;
  ai: AiParsedJson | null;
  meta: MessageMeta | null;
}

export interface ConversationVM {
  id: string;
  type: Conversation["type"];
  title: string;
  participants: Array<{ id: string; name: string; lastReadAt: string | null }>;
  messages: MessageVM[];
  isParticipant: boolean;
}

async function visibleConversations(store: Store, s: ProjectSession) {
  const convs = await store.select("conversations", { where: { project_id: s.project.id } });
  if (!convs.length) return { convs: [], parts: [] };
  const parts = await store.select("conversation_participants", { where: { conversation_id: { in: convs.map((c) => c.id) } } });
  const visible = convs.filter((c) => canSeeConversation(s, c, parts.filter((p) => p.conversation_id === c.id)));
  return { convs: visible, parts: parts.filter((p) => visible.some((c) => c.id === p.conversation_id)) };
}

function conversationTitle(c: Conversation, others: string[]): string {
  if (c.title) return c.title;
  return others.join(", ") || t.chat.title;
}

function preview(m: Message | undefined): string {
  if (!m) return "";
  if (m.kind === "image") return t.chat.photo;
  if (m.kind === "voice") return t.chat.voice;
  return m.text ?? "";
}

export async function listConversations(store: Store, s: ProjectSession): Promise<ConversationListItem[]> {
  const { convs, parts } = await visibleConversations(store, s);
  if (!convs.length) return [];
  const profileIds = [...new Set(parts.map((p) => p.profile_id))];
  const [profiles, messages, contractors, trades] = await Promise.all([
    store.select("profiles", { where: { id: { in: profileIds } } }),
    store.select("messages", { where: { conversation_id: { in: convs.map((c) => c.id) } }, order: [["created_at", "asc"]] }),
    store.select("contractors", { where: { profile_id: { in: profileIds } } }),
    store.select("trades"),
  ]);
  const name = new Map(profiles.map((p) => [p.id, p.full_name]));
  const pm = isPM(s);

  return convs
    .map((c) => {
      const cp = parts.filter((p) => p.conversation_id === c.id);
      const others = cp.filter((p) => p.profile_id !== s.profile.id);
      const msgs = messages.filter((m) => m.conversation_id === c.id);
      const me = cp.find((p) => p.profile_id === s.profile.id);
      const lastRead = me?.last_read_at ?? "";
      const otherContractor = c.type === "direct" ? contractors.find((x) => others.some((o) => o.profile_id === x.profile_id)) : undefined;
      const trade = otherContractor?.trade_id ? trades.find((tr) => tr.id === otherContractor.trade_id)?.name : null;
      return {
        id: c.id,
        type: c.type,
        title: conversationTitle(c, others.map((o) => name.get(o.profile_id) ?? "")),
        subtitle: c.type === "group" ? t.chat.participants(cp.length) : otherContractor ? [trade, otherContractor.company].filter(Boolean).join(" · ") : null,
        lastText: preview(msgs.at(-1)),
        lastAt: c.last_message_at ?? msgs.at(-1)?.created_at ?? null,
        unread: me ? msgs.filter((m) => m.sender_profile_id !== s.profile.id && m.created_at > lastRead).length : 0,
        participants: cp.length,
        pendingAi: pm ? msgs.filter((m) => m.ai_status === "suggested").length : 0,
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function getConversation(store: Store, s: ProjectSession, id: string, limit = 300): Promise<ConversationVM> {
  const conv = await store.byId("conversations", id);
  if (!conv || conv.project_id !== s.project.id) throw new AccessError(t.errors.notFound, 404);
  const parts = await store.select("conversation_participants", { where: { conversation_id: id } });
  if (!canSeeConversation(s, conv, parts)) throw new AccessError(t.errors.forbidden, 403);
  const [profiles, messages] = await Promise.all([
    store.select("profiles", { where: { id: { in: parts.map((p) => p.profile_id) } } }),
    store.select("messages", { where: { conversation_id: id }, order: [["created_at", "desc"]], limit }),
  ]);
  messages.reverse();
  const extraSenders = [...new Set(messages.map((m) => m.sender_profile_id).filter((x): x is string => !!x && !profiles.some((p) => p.id === x)))];
  if (extraSenders.length) profiles.push(...(await store.select("profiles", { where: { id: { in: extraSenders } } })));
  const name = new Map(profiles.map((p) => [p.id, p.full_name]));
  const pm = isPM(s);

  const vms: MessageVM[] = messages.map((m) => {
    const others = parts.filter((p) => p.profile_id !== m.sender_profile_id);
    return {
      id: m.id,
      kind: m.kind,
      text: m.text,
      mediaUrl: m.media_url,
      createdAt: m.created_at,
      senderId: m.sender_profile_id,
      senderName: m.sender_profile_id ? name.get(m.sender_profile_id) ?? "" : t.chat.system,
      mine: m.sender_profile_id === s.profile.id,
      readByAll: others.length > 0 && others.every((p) => !!p.last_read_at && p.last_read_at >= m.created_at),
      aiStatus: m.ai_status,
      // AI suggestions are the PM's to review; others see only the outcome
      ai: pm || m.ai_status === "accepted" ? m.ai_parsed_json : null,
      meta: m.meta,
    };
  });

  const others = parts.filter((p) => p.profile_id !== s.profile.id).map((p) => name.get(p.profile_id) ?? "");
  return {
    id,
    type: conv.type,
    title: conversationTitle(conv, others),
    participants: parts.map((p) => ({ id: p.profile_id, name: name.get(p.profile_id) ?? "", lastReadAt: p.last_read_at })),
    messages: vms,
    isParticipant: parts.some((p) => p.profile_id === s.profile.id),
  };
}

export async function sendMessage(
  ctx: Ctx,
  conversationId: string,
  input: { text?: string | null; kind?: Exclude<MessageKind, "system">; mediaUrl?: string | null; replyToId?: string | null },
): Promise<Message> {
  const { store, s } = ctx;
  const conv = await store.byId("conversations", conversationId);
  if (!conv || conv.project_id !== s.project.id) throw new AccessError(t.errors.notFound, 404);
  const parts = await store.select("conversation_participants", { where: { conversation_id: conversationId } });
  if (!canSeeConversation(s, conv, parts) || s.role === "viewer" && !parts.some((p) => p.profile_id === s.profile.id))
    throw new AccessError(t.errors.forbidden, 403);
  // A PM writing into a conversation he only oversees joins it.
  if (!parts.some((p) => p.profile_id === s.profile.id))
    await store.insert("conversation_participants", { conversation_id: conversationId, profile_id: s.profile.id });

  const text = input.text?.trim() || null;
  const kind = input.kind ?? (input.mediaUrl ? "image" : "text");
  if (!text && !input.mediaUrl) throw new AccessError(t.errors.invalid, 403);
  if (input.mediaUrl && !isOwnMediaKey(input.mediaUrl, s.project.id)) throw new AccessError(t.errors.invalid, 403);

  const now = (ctx.now ?? new Date()).toISOString();
  const [msg] = await store.insert("messages", {
    conversation_id: conversationId,
    project_id: s.project.id,
    sender_profile_id: s.profile.id,
    kind,
    text,
    media_url: input.mediaUrl ?? null,
    reply_to_id: input.replyToId ?? null,
    created_at: now,
  });
  await store.update("conversation_participants", { conversation_id: conversationId, profile_id: s.profile.id }, { last_read_at: now });
  await relayMessage(store, msg);
  return msg;
}

/** Uploaded media keys are namespaced by project: media/<projectId>/<file>. */
export function isOwnMediaKey(key: string, projectId: string) {
  return key.startsWith(`media/${projectId}/`) && !key.includes("..");
}

export async function markRead(ctx: Ctx, conversationId: string) {
  const now = (ctx.now ?? new Date()).toISOString();
  await ctx.store.update(
    "conversation_participants",
    { conversation_id: conversationId, profile_id: ctx.s.profile.id },
    { last_read_at: now },
  );
}

/** Open (or create) a 1:1 conversation with another project member. */
export async function startDirect(ctx: Ctx, otherProfileId: string): Promise<string> {
  const { store, s } = ctx;
  const member = await store.first("project_members", { where: { project_id: s.project.id, profile_id: otherProfileId } });
  if (!member || otherProfileId === s.profile.id) throw new AccessError(t.errors.notFound, 404);
  // Contractors / viewers may only start chats with a PM
  if (!isPM(s) && member.role !== "pm") throw new AccessError(t.errors.forbidden, 403);
  return directConversation(store, s.project.id, s.profile.id, otherProfileId);
}
