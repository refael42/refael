"use server";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import * as chat from "@/lib/services/chat";
import { sessionOrThrow } from "@/lib/services/session";
import { run } from "./_run";

export async function sendMessageAction(
  conversationId: string,
  input: { text?: string | null; kind?: "text" | "image" | "voice" | "file"; mediaUrl?: string | null },
) {
  return run(async (ctx) => {
    const msg = await chat.sendMessage(ctx, conversationId, input);
    return { id: msg.id };
  });
}

export async function markReadAction(conversationId: string) {
  const s = await sessionOrThrow();
  await chat.markRead({ store: getStore(), s }, conversationId);
}

export async function startDirectAction(profileId: string) {
  const s = await sessionOrThrow();
  const id = await chat.startDirect({ store: getStore(), s }, profileId);
  redirect(`/chat/${id}`);
}
