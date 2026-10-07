"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { enterGate } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {t.gate.enter}
    </Button>
  );
}

export function GateForm({ next }: { next: string }) {
  const [state, action] = useFormState(enterGate, { error: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <Input id="gate-password" name="password" type="password" placeholder={t.gate.password} autoFocus autoComplete="current-password" aria-label={t.gate.password} />
      {state.error && <p className="text-sm text-destructive">{t.gate.wrong}</p>}
      <Submit />
    </form>
  );
}
