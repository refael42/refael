import { HardHat } from "lucide-react";
import { redirect } from "next/navigation";
import { demoLogin, resetDemo } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { isSupabaseMode } from "@/lib/env";
import { t } from "@/lib/i18n";
import { canCreateProject } from "@/lib/services/project";
import { getSession } from "@/lib/services/session";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { noaccess?: string; reset?: string } }) {
  const session = await getSession();
  if (session?.project && !searchParams.noaccess) redirect(session.role === "contractor" ? "/my" : "/");
  // signed in without a project: PMs and listed admins open one right away
  if (session && !session.project && canCreateProject(session)) redirect("/setup");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <HardHat className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">{t.app.name}</h1>
        <p className="text-sm text-muted-foreground">{t.app.tagline}</p>
      </div>

      {searchParams.noaccess && (
        <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">{t.auth.noAccess}</p>
      )}
      {searchParams.reset && <p className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-900">{t.auth.resetDone}</p>}

      {isSupabaseMode() ? <LoginForm /> : <DemoPicker />}
    </main>
  );
}

async function DemoPicker() {
  const store = getStore();
  const members = await store.select("project_members");
  const profiles = await store.select("profiles", { where: { id: { in: members.map((m) => m.profile_id) } } });
  const contractors = await store.select("contractors");
  const trades = await store.select("trades");
  const roleOf = new Map(members.map((m) => [m.profile_id, m.role]));
  const order = { pm: 0, viewer: 1, contractor: 2 } as const;
  const people = profiles
    .map((p) => {
      const c = contractors.find((x) => x.profile_id === p.id);
      const trade = c ? trades.find((tr) => tr.id === c.trade_id)?.name : null;
      return { ...p, role: roleOf.get(p.id)!, sub: trade ?? null };
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.full_name.localeCompare(b.full_name, "he"));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t.auth.demoTitle}</CardTitle>
          <Badge variant="secondary">{t.app.demoBadge}</Badge>
        </div>
        <CardDescription>{t.auth.demoHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {people.map((p) => (
          <form key={p.id} action={demoLogin}>
            <input type="hidden" name="profileId" value={p.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {initials(p.full_name)}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.roles[p.role]}
                  {p.sub ? ` · ${p.sub}` : ""}
                </span>
              </span>
            </button>
          </form>
        ))}
        <form action={resetDemo} className="pt-2">
          <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
            {t.auth.resetDemo}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
