import type { Store } from "../db/store";
import { isPM } from "./access";
import type { ProjectSession } from "./session";

/** Badge counts for the navigation. */
export async function navCounts(store: Store, s: ProjectSession) {
  const projectId = s.project.id;
  const [notifications, parts] = await Promise.all([
    store.select("notifications", { where: { profile_id: s.profile.id, read_at: null } }),
    store.select("conversation_participants", { where: { profile_id: s.profile.id } }),
  ]);

  let chat = 0;
  if (parts.length) {
    const convs = await store.select("conversations", {
      where: { id: { in: parts.map((p) => p.conversation_id) }, project_id: projectId },
    });
    const convIds = new Set(convs.map((c) => c.id));
    const oldest = parts.reduce((m, p) => (!p.last_read_at || p.last_read_at < m ? p.last_read_at ?? "" : m), "9999");
    const recent = await store.select("messages", {
      where: { conversation_id: { in: [...convIds] }, ...(oldest ? { created_at: { gt: oldest } } : {}) },
    });
    const lastRead = new Map(parts.map((p) => [p.conversation_id, p.last_read_at ?? ""]));
    chat = recent.filter((m) => m.sender_profile_id !== s.profile.id && m.created_at > (lastRead.get(m.conversation_id) ?? "")).length;
  }

  let approvals = 0;
  if (isPM(s)) {
    const [suggested, tasks] = await Promise.all([
      store.select("messages", { where: { project_id: projectId, ai_status: "suggested" } }),
      store.select("tasks", { where: { project_id: projectId, status: "awaiting_approval" } }),
    ]);
    approvals = suggested.length + tasks.length;
  }
  return { notifications: notifications.length, chat, approvals };
}
