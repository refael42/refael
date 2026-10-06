"use server";
import { getStore } from "@/lib/db";
import { assertPM } from "@/lib/services/access";
import { AccessError } from "@/lib/services/auth-types";
import { sendMessage } from "@/lib/services/chat";
import { runTick } from "@/lib/services/reminders";
import { he } from "@/lib/i18n/he";
import { run } from "./_run";

export async function markNotificationReadAction(id: string) {
  return run(async ({ store, s }) => {
    await store.update("notifications", { id, profile_id: s.profile.id }, { read_at: new Date().toISOString() });
  });
}

export async function markAllNotificationsReadAction() {
  return run(async ({ store, s }) => {
    await store.update("notifications", { profile_id: s.profile.id, read_at: null }, { read_at: new Date().toISOString() });
  });
}

/** One-tap follow-up from a reminder: sends the prepared message to the contractor. */
export async function sendFollowUpAction(notificationId: string) {
  return run(async (ctx) => {
    const n = await ctx.store.byId("notifications", notificationId);
    if (!n || n.profile_id !== ctx.s.profile.id || n.action?.type !== "send_follow_up") throw new AccessError(he.errors.notFound, 404);
    await sendMessage(ctx, n.action.conversation_id, { text: n.action.text });
    await ctx.store.update("notifications", { id: n.id }, { read_at: new Date().toISOString(), action: null });
    return n.action.conversation_id;
  });
}

export async function runChecksNowAction() {
  return run(async ({ s }) => {
    assertPM(s);
    return (await runTick(getStore(), new Date(), { projectId: s.project.id })).reminders;
  });
}
