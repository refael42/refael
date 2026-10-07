/**
 * Placeholder for future channels (out of MVP scope — designed for, not built).
 *
 * A WhatsApp Business / SMS sender only has to implement NotificationChannel
 * and be registered in channels/index.ts; callers of notify() don't change.
 *
 *   export const whatsappChannel: NotificationChannel = {
 *     name: "whatsapp",
 *     async send(n, store) {
 *       const profile = await store.byId("profiles", n.profile_id);
 *       if (!profile?.phone) return;
 *       await whatsappClient.sendTemplate(profile.phone, "siteflow_alert", [n.title, n.body ?? ""]);
 *     },
 *   };
 *
 * Inbound WhatsApp messages would be written to `messages` and go through the
 * same analyzeMessage() → PM approval path as in-app chat.
 */
export {};
