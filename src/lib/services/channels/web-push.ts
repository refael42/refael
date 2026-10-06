import "server-only";
import webpush from "web-push";
import type { Store } from "../../db/store";
import type { NotificationRow } from "../../db/types";
import { serverEnv } from "../../env";
import type { NotificationChannel } from "../notify";

let configured = false;

export function webPushConfigured() {
  return Boolean(serverEnv.vapidPublicKey && serverEnv.vapidPrivateKey);
}

/** Web Push (VAPID) to every browser the person subscribed from. */
export const webPushChannel: NotificationChannel = {
  name: "web-push",
  async send(n: NotificationRow, store: Store) {
    if (!webPushConfigured()) return;
    if (!configured) {
      webpush.setVapidDetails(serverEnv.vapidSubject, serverEnv.vapidPublicKey, serverEnv.vapidPrivateKey);
      configured = true;
    }
    const subs = await store.select("push_subscriptions", { where: { profile_id: n.profile_id } });
    const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/notifications", tag: n.kind, urgent: n.urgent });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await store.remove("push_subscriptions", { id: sub.id }); // expired
          else throw err;
        }
      }),
    );
  },
};
