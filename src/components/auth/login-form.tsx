"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Israeli local format → E.164 (050-1234567 → +972501234567). */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export function LoginForm() {
  const router = useRouter();
  const supabase = getBrowserSupabase()!;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ error: { message: string } | null }>, onOk: () => void) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error.message || t.auth.invalid);
    else onOk();
  }

  const done = () => {
    router.replace("/");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auth.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="phone">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone">{t.auth.phoneTab}</TabsTrigger>
            <TabsTrigger value="email">{t.auth.emailTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="flex flex-col gap-3">
            {!sent ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => supabase.auth.signInWithOtp({ phone: toE164(phone) }), () => setSent(true));
                }}
              >
                <Label htmlFor="phone">{t.auth.phoneLabel}</Label>
                <Input id="phone" dir="ltr" inputMode="tel" autoComplete="tel" placeholder={t.auth.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                <Button type="submit" size="lg" disabled={busy}>
                  {t.auth.sendCode}
                </Button>
              </form>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: "sms" }), done);
                }}
              >
                <p className="text-sm text-muted-foreground">{t.auth.codeSent(phone)}</p>
                <Label htmlFor="code">{t.auth.codeLabel}</Label>
                <Input id="code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
                <Button type="submit" size="lg" disabled={busy}>
                  {t.auth.verify}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="email">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => supabase.auth.signInWithPassword({ email, password }), done);
              }}
            >
              <Label htmlFor="email">{t.auth.emailLabel}</Label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Label htmlFor="password">{t.auth.passwordLabel}</Label>
              <Input id="password" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" size="lg" disabled={busy || !password}>
                {t.auth.signIn}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !email}
                onClick={() =>
                  run(
                    () => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } }),
                    () => toast.success(t.auth.magicSent),
                  )
                }
              >
                {t.auth.magicLink}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
