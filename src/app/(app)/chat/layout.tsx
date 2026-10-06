import { ChatShell } from "@/components/chat/chat-shell";
import { getStore } from "@/lib/db";
import { isPM } from "@/lib/services/access";
import { listConversations } from "@/lib/services/chat";
import { requireProjectSession } from "@/lib/services/session";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const s = await requireProjectSession();
  const store = getStore();
  const conversations = await listConversations(store, s);
  // People you may start a 1:1 with: PM → everyone; others → the PMs
  const members = await store.select("project_members", { where: { project_id: s.project.id } });
  const allowed = members.filter((m) => m.profile_id !== s.profile.id && (isPM(s) || m.role === "pm"));
  const profiles = allowed.length ? await store.select("profiles", { where: { id: { in: allowed.map((m) => m.profile_id) } } }) : [];
  const people = profiles
    .map((p) => ({ id: p.id, name: p.full_name, role: allowed.find((m) => m.profile_id === p.id)!.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  return (
    <ChatShell conversations={conversations} people={people}>
      {children}
    </ChatShell>
  );
}
