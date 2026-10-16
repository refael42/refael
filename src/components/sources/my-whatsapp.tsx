"use client";
import { Eye, EyeOff, MessageCircle, Smartphone, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { connectWhatsappAction, disconnectWhatsappAction, setWhatsappContactAction } from "@/app/actions/wa-link";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime, t } from "@/lib/i18n";
import type { WhatsappOverview } from "@/lib/services/wa-link";

type FB = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: { authResponse?: { code?: string } }) => void, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    FB?: FB;
    fbAsyncInit?: () => void;
  }
}

/** Meta's JavaScript SDK, loaded once, only when the PM connects. */
function loadFb(appId: string, version: string): Promise<FB> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB!);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("sdk"));
    document.body.appendChild(s);
  });
}

const local = (wa: string) => (wa.startsWith("972") ? `0${wa.slice(3)}` : `+${wa}`);

export function MyWhatsapp({ overview, appId, configId, version }: { overview: WhatsappOverview; appId: string; configId: string; version: string }) {
  const { call, pending } = useAction();
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);
  const ids = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const ready = !!(appId && configId);
  const link = overview.link;
  const on = link?.status === "connected";

  // Embedded Signup reports the chosen number through a window message
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.data?.phone_number_id) ids.current = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id };
        if (data.event === "CANCEL") toast.message(t.waLink.canceled);
      } catch {
        /* other messages from facebook.com */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const fb = await loadFb(appId, version);
      const code = await new Promise<string | null>((resolve) =>
        fb.login((r) => resolve(r.authResponse?.code ?? null), {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
        }),
      );
      // the number's ids arrive by message, sometimes just after the login callback
      for (let i = 0; i < 20 && !ids.current.phoneNumberId; i++) await new Promise((r) => setTimeout(r, 250));
      const { wabaId, phoneNumberId } = ids.current;
      if (!code || !wabaId || !phoneNumberId) {
        toast.message(t.waLink.canceled);
        return;
      }
      await call(() => connectWhatsappAction({ code, wabaId, phoneNumberId }), (r) => t.waLink.connected(r.phone ?? ""));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" />
          {t.waLink.title}
          {link && <Badge variant={on ? "ready" : "outline"}>{on ? t.waLink.connected(link.display_phone ?? "") : t.waLink.disconnected}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">{t.waLink.hint}</p>
        {!on && (
          <div className="flex flex-col gap-1">
            <Button className="self-start" disabled={!ready || busy} onClick={connect}>
              <MessageCircle />
              {busy ? t.waLink.connecting : t.waLink.connect}
            </Button>
            {!ready && <span className="text-xs text-muted-foreground">{t.waLink.setupMissing}</span>}
          </div>
        )}

        {overview.pending.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t.waLink.pending}</span>
            <span className="text-xs text-muted-foreground">{t.waLink.pendingHint}</span>
            <div className="flex flex-col divide-y rounded-md border">
              {overview.pending.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{c.name ?? <bdi dir="ltr">{local(c.wa_id)}</bdi>}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.name && <bdi dir="ltr">{local(c.wa_id)} · </bdi>}
                      {t.waLink.messages(c.message_count)}
                      {c.last_at ? ` · ${fmtDateTime(c.last_at)}` : ""}
                    </span>
                  </span>
                  <Button size="sm" disabled={pending} onClick={() => call(() => setWhatsappContactAction(c.id, "follow"), t.app.saved)}>
                    <Eye />
                    {t.waLink.follow}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => call(() => setWhatsappContactAction(c.id, "ignore"), t.app.saved)}>
                    <EyeOff />
                    {t.waLink.ignore}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {overview.followed.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t.waLink.followed}</span>
            <span className="text-xs text-muted-foreground">{t.waLink.followedHint}</span>
            <div className="flex flex-col divide-y rounded-md border">
              {overview.followed.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{c.name ?? <bdi dir="ltr">{local(c.wa_id)}</bdi>}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.waLink.messages(c.message_count)}
                      {c.projectName ? ` · ${c.projectName}` : ""}
                      {c.last_at ? ` · ${fmtDateTime(c.last_at)}` : ""}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStopping(c.id)}>
                    <EyeOff />
                    {t.waLink.stop}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {overview.ignored.length > 0 && <span className="text-xs text-muted-foreground">{t.waLink.ignored(overview.ignored.length)}</span>}

        {on && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            disabled={pending}
            onClick={() => window.confirm(t.waLink.disconnectConfirm) && call(() => disconnectWhatsappAction(), t.app.saved)}
          >
            <Unplug />
            {t.waLink.disconnect}
          </Button>
        )}
      </CardContent>

      <Dialog open={!!stopping} onOpenChange={(o) => !o && setStopping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.waLink.stop}</DialogTitle>
            <DialogDescription>{t.waLink.stopConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={async () => {
                await call(() => setWhatsappContactAction(stopping!, "ignore", false), t.app.saved);
                setStopping(null);
              }}
            >
              {t.waLink.stopKeep}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                await call(() => setWhatsappContactAction(stopping!, "ignore", true), t.app.saved);
                setStopping(null);
              }}
            >
              {t.waLink.stopAndDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
