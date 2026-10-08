import type { Store } from "../db/store";
import type { Message, MessageMeta } from "../db/types";

/**
 * Message relays (WhatsApp) see every chat message after it is stored.
 * Registered at startup like notification channels; a relay must not throw.
 */
type MessageRelay = (store: Store, msg: Message) => Promise<void>;
const relays: MessageRelay[] = [];

export function registerMessageRelay(r: MessageRelay) {
  if (!relays.includes(r)) relays.push(r);
}

export async function relayMessage(store: Store, msg: Message) {
  for (const r of relays) await r(store, msg).catch((err) => console.warn("[relay] failed", err));
}

/** Project managers of a project (profile ids). */
export async function projectPMs(store: Store, projectId: string): Promise<string[]> {
  const pms = await store.select("project_members", { where: { project_id: projectId, role: "pm" } });
  return pms.map((m) => m.profile_id).sort();
}

/** The 1:1 conversation between two people in a project; created if missing. */
export async function directConversation(store: Store, projectId: string, a: string, b: string): Promise<string> {
  const mine = await store.select("conversation_participants", { where: { profile_id: a } });
  if (mine.length) {
    const convs = await store.select("conversations", {
      where: { id: { in: mine.map((p) => p.conversation_id) }, project_id: projectId, type: "direct" },
    });
    if (convs.length) {
      const theirs = await store.select("conversation_participants", {
        where: { conversation_id: { in: convs.map((c) => c.id) }, profile_id: b },
      });
      if (theirs.length) return theirs[0].conversation_id;
    }
  }
  const [conv] = await store.insert("conversations", { project_id: projectId, type: "direct", title: null });
  await store.insert("conversation_participants", [
    { conversation_id: conv.id, profile_id: a },
    { conversation_id: conv.id, profile_id: b },
  ]);
  return conv.id;
}

export async function postSystemMessage(
  store: Store,
  projectId: string,
  conversationId: string,
  text: string,
  meta: MessageMeta | null = null,
): Promise<Message> {
  const [m] = await store.insert("messages", {
    conversation_id: conversationId,
    project_id: projectId,
    sender_profile_id: null,
    kind: "system",
    text,
    meta,
  });
  await relayMessage(store, m);
  return m;
}

/** Profile id of a contractor (null if the contractor has no app identity). */
export async function contractorProfile(store: Store, contractorId: string | null): Promise<string | null> {
  if (!contractorId) return null;
  const c = await store.byId("contractors", contractorId);
  return c?.profile_id ?? null;
}

/**
 * Send a system message from the project to a contractor in the PM↔contractor
 * direct chat (the "auto-message to Vadim" path).
 */
export async function messageContractor(
  store: Store,
  projectId: string,
  contractorId: string | null,
  text: string,
  meta: MessageMeta | null = null,
): Promise<{ profileId: string; conversationId: string } | null> {
  const profileId = await contractorProfile(store, contractorId);
  if (!profileId) return null;
  // setup mode: the PM is still entering the project — don't message contractors yet
  if ((await store.byId("projects", projectId))?.setup_mode) return null;
  const [pm] = await projectPMs(store, projectId);
  if (!pm) return null;
  const conversationId = await directConversation(store, projectId, pm, profileId);
  await postSystemMessage(store, projectId, conversationId, text, meta);
  return { profileId, conversationId };
}
