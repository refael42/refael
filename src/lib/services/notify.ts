/**
 * Engine 4 — notification dispatch.
 *
 * A notification is written once and fanned out to every registered channel.
 * Channels implement `NotificationChannel`; in-app and web push ship today,
 * WhatsApp / SMS can be added later by registering another channel (see
 * channels/whatsapp.ts for the intended shape) without touching callers.
 */
import type { Store } from "../db/store";
import type { NotificationAction, NotificationRow } from "../db/types";

export interface OutgoingNotification {
  profileId: string;
  projectId: string | null;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  action?: NotificationAction | null;
  urgent?: boolean;
}

export interface NotificationChannel {
  readonly name: string;
  /** Deliver one already-persisted notification. Must not throw for one bad recipient. */
  send(n: NotificationRow, store: Store): Promise<void>;
}

const channels: NotificationChannel[] = [];

export function registerChannel(c: NotificationChannel) {
  if (!channels.some((x) => x.name === c.name)) channels.push(c);
}

export function registeredChannels(): readonly NotificationChannel[] {
  return channels;
}

/** Persist (= in-app channel) and fan out to the other channels. */
export async function notify(store: Store, list: OutgoingNotification[]): Promise<NotificationRow[]> {
  if (!list.length) return [];
  const rows = await store.insert(
    "notifications",
    list.map((n) => ({
      profile_id: n.profileId,
      project_id: n.projectId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      action: n.action ?? null,
      urgent: n.urgent ?? false,
    })),
  );
  await Promise.all(
    rows.flatMap((row) =>
      channels.map((c) =>
        c.send(row, store).catch((err) => console.warn(`[notify] channel ${c.name} failed`, err)),
      ),
    ),
  );
  return rows;
}
