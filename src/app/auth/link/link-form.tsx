"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { enterWithLink } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {t.auth.linkEnter}
    </Button>
  );
}

// a button, not an automatic sign-in: WhatsApp link previews open the URL and would use up the one-time link
export function LinkForm({ token }: { token: string }) {
  const [state, action] = useFormState(enterWithLink, { error: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="t" value={token} />
      {state.error ? (
        <>
          <p className="text-sm text-destructive">{t.auth.linkExpired}</p>
          <Button asChild variant="outline">
            <Link href="/login">{t.auth.title}</Link>
          </Button>
        </>
      ) : (
        <Submit />
      )}
    </form>
  );
}
