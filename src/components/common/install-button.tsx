"use client";
import { Download, KeyRound, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { ownCodeAction } from "@/app/actions/login-link";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Add to home screen". Android / desktop Chrome offer it themselves; an
 * iPhone never does, so there the button explains Safari's Share → "Add to
 * Home Screen". Hidden once the app runs from the home screen.
 */
export function InstallButton() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);
  const [code, setCode] = useState<{ code: string; phone: string | null } | null>(null);
  const { call, pending } = useAction();
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (!evt && !ios) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          if (!evt) return setHelp(true);
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
      >
        <Download />
        {t.app.install}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.app.install}</DialogTitle>
            <DialogDescription>{t.app.installIosHint}</DialogDescription>
          </DialogHeader>
          <ol className="flex list-inside list-decimal flex-col gap-2 text-sm">
            <li>
              {t.app.installIos1}{" "}
              <Share className="inline h-4 w-4 align-text-bottom" />
            </li>
            <li>{t.app.installIos2}</li>
            <li>{t.app.installIos3}</li>
            <li>{t.app.installIos4}</li>
          </ol>
          {code ? (
            <p className="rounded-md border bg-muted/50 p-3 text-center text-sm font-medium" dir="rtl">
              {t.app.yourCode(code.code, code.phone ?? "")}
            </p>
          ) : (
            <Button variant="outline" disabled={pending} onClick={async () => setCode(await call(() => ownCodeAction()))}>
              <KeyRound />
              {t.app.makeCode}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
