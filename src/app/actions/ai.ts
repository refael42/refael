"use server";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db";
import { canSeeConversation } from "@/lib/services/access";
import * as ai from "@/lib/services/ai-suggestions";
import { sessionOrThrow } from "@/lib/services/session";
import { suggestionLabels } from "@/lib/services/tasks";
import { run } from "./_run";

/** Parse a just-sent message. Any participant may trigger it; it only stores a suggestion. */
export async function analyzeMessageAction(messageId: string) {
  const s = await sessionOrThrow();
  const store = getStore();
  const msg = await store.byId("messages", messageId);
  if (!msg || msg.project_id !== s.project.id) return;
  const conv = await store.byId("conversations", msg.conversation_id);
  const parts = await store.select("conversation_participants", { where: { conversation_id: msg.conversation_id } });
  if (!conv || !canSeeConversation(s, conv, parts)) return;
  await ai.analyzeMessage(store, messageId);
  revalidatePath("/", "layout");
}

export async function approveSuggestionAction(messageId: string, edits?: ai.ApproveEdits) {
  return run(async (ctx) => {
    const r = await ai.approveSuggestion(ctx, messageId, edits ?? {});
    return { ...r, labels: await suggestionLabels(ctx, r.suggestions) };
  });
}

export async function dismissSuggestionAction(messageId: string) {
  return run(async (ctx) => {
    await ai.dismissSuggestion(ctx, messageId);
  });
}
