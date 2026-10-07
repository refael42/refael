import { notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat/chat-room";
import { getStore } from "@/lib/db";
import { isPM } from "@/lib/services/access";
import { AccessError } from "@/lib/services/auth-types";
import { getConversation } from "@/lib/services/chat";
import { requireProjectSession } from "@/lib/services/session";
import { loadSnapshot } from "@/lib/services/snapshot";
import { formOptions } from "@/lib/services/views";

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const s = await requireProjectSession();
  const store = getStore();
  let conv;
  try {
    conv = await getConversation(store, s, params.id);
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  // The PM edits AI suggestions against the project's areas / contractors / tasks
  const pm = isPM(s);
  const options = pm ? formOptions(await loadSnapshot(store, s.project.id)) : null;
  const taskOptions = pm
    ? (await store.select("tasks", { where: { project_id: s.project.id } })).map((x) => ({ value: x.id, label: x.title }))
    : [];
  return (
    <ChatRoom
      key={conv.id}
      conversation={conv}
      me={{ id: s.profile.id, role: s.role }}
      options={options}
      taskOptions={taskOptions}
    />
  );
}
