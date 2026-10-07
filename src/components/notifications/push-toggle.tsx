"use client";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

function b64ToUint8(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "on" | "off">("unknown");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  if (state === "unsupported") return <span className="text-xs text-muted-foreground">{t.notify.pushUnsupported}</span>;
  if (state === "on")
    return (
      <span className="flex items-center gap-1 text-xs text-state-ready">
        <BellRing className="h-3.5 w-3.5" />
        {t.notify.pushEnabled}
      </span>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={state === "unknown"}
      onClick={async () => {
        if (!vapidKey) return toast.info(t.notify.pushNotConfigured);
        try {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) });
          const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
          if (!res.ok) throw new Error();
          setState("on");
          toast.success(t.notify.pushEnabled);
        } catch {
          toast.error(t.app.error);
        }
      }}
    >
      <BellRing />
      {t.notify.enablePush}
    </Button>
  );
}
