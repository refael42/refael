"use client";
import { BellRing } from "lucide-react";
import { setSetupModeAction } from "@/app/actions/project";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function ActivateButton() {
  const { call, pending } = useAction();
  return (
    <Button size="sm" disabled={pending} onClick={() => confirm(t.setup.activateConfirm) && call(() => setSetupModeAction(false), t.setup.activated)}>
      <BellRing />
      {t.setup.activate}
    </Button>
  );
}
