import { NotificationList } from "@/components/notifications/notification-list";
import { getStore } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.notify.title };

export default async function NotificationsPage() {
  const s = await requireProjectSession();
  const items = await getStore().select("notifications", {
    where: { profile_id: s.profile.id },
    order: [["created_at", "desc"]],
    limit: 100,
  });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold">{t.notify.title}</h1>
      <NotificationList items={items} isPM={isPM(s)} vapidKey={serverEnv.vapidPublicKey} />
    </div>
  );
}
