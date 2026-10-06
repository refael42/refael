"use client";
import { AlertTriangle, Bell, CheckCheck, PlayCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction, runChecksNowAction, sendFollowUpAction } from "@/app/actions/notifications";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/lib/db/types";
import { RelativeTime } from "@/components/common/relative-time";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

export function NotificationList({ items, isPM, vapidKey }: { items: NotificationRow[]; isPM: boolean; vapidKey: string }) {
  const router = useRouter();
  const { call, pending } = useAction();
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PushToggle vapidKey={vapidKey} />
        {unread > 0 && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => call(() => markAllNotificationsReadAction())}>
            <CheckCheck />
            {t.notify.markAllRead}
          </Button>
        )}
        {isPM && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => call(() => runChecksNowAction(), (n) => t.notify.checksDone(n))}>
            <PlayCircle />
            {t.notify.runChecks}
          </Button>
        )}
      </div>
      {items.length === 0 && (
        <p className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Bell className="h-8 w-8" />
          {t.notify.empty}
        </p>
      )}
      {items.map((n) => (
        <div
          key={n.id}
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3",
            !n.read_at && "border-primary/30 bg-primary/5",
            n.urgent && !n.read_at && "border-state-blocked/50 bg-state-blocked/5",
          )}
        >
          <div className="flex items-start gap-2">
            {n.urgent ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-state-blocked" /> : <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <Link
              href={n.link ?? "#"}
              className="flex flex-1 flex-col gap-0.5"
              onClick={() => !n.read_at && markNotificationReadAction(n.id)}
            >
              <span className="flex items-center gap-2 font-medium">
                {n.title}
                {n.urgent && <Badge variant="blocked">{t.notify.urgent}</Badge>}
              </span>
              {n.body && <span className="text-sm text-muted-foreground">{n.body}</span>}
              <span className="text-xs text-muted-foreground">
                <RelativeTime value={n.created_at} />
              </span>
            </Link>
            {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </div>
          {n.action?.type === "send_follow_up" && (
            <div className="flex flex-col gap-2 rounded-md bg-muted/60 p-2 text-sm">
              <span className="text-muted-foreground">“{n.action.text}”</span>
              <Button
                size="sm"
                className="self-start"
                disabled={pending}
                onClick={async () => {
                  const conv = await call(() => sendFollowUpAction(n.id), t.notify.followUpSent);
                  if (conv) router.push(`/chat/${conv}`);
                }}
              >
                <Send className="-scale-x-100" />
                {t.notify.sendFollowUp}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
