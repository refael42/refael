"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { enterWithCode } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {t.auth.linkEnter}
    </Button>
  );
}

/** Phone + 6-digit code — for the home-screen app, where a link cannot be opened. */
export function CodeForm() {
  const [state, action] = useFormState(enterWithCode, { error: false });
  return (
    <form action={action} className="flex flex-col gap-3 text-start">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code-phone">{t.auth.phoneLabel}</Label>
        <Input id="code-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder={t.auth.phonePlaceholder} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code-code">{t.auth.loginCode}</Label>
        <Input id="code-code" name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} placeholder="123456" required className="text-center text-lg tracking-widest" />
      </div>
      {state.error && <p className="text-sm text-destructive">{t.auth.codeWrong}</p>}
      <Submit />
    </form>
  );
}
