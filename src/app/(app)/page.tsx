import { AlertTriangle, ArrowLeft, CheckCheck, Flame, Hourglass, Lightbulb, Sparkles, Unlock, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TaskRow } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { fmtDate, t } from "@/lib/i18n";
import { requireProjectSession } from "@/lib/services/session";
import { loadSnapshot } from "@/lib/services/snapshot";
import { homeView, type NeedYouVM } from "@/lib/services/views";
import { cn } from "@/lib/utils";

export const metadata = { title: t.home.title };

export default async function HomePage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const vm = homeView(snap);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:p-6">
      {/* Hero: what can be executed right now */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-3 p-5">
            <h1 className="text-lg font-semibold">{t.home.title}</h1>
            <Link href="/tasks?state=ready" className="flex items-end gap-3">
              <span className="num text-7xl font-extrabold leading-none text-state-ready">{vm.readyCount}</span>
              <span className="pb-2 text-muted-foreground">{t.home.readyNow}</span>
            </Link>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat href="/tasks?state=blocked" n={vm.stats.blocked} label={t.home.stats.blocked} className="text-state-blocked" />
              <Stat href="/tasks?state=in_progress" n={vm.stats.inProgress} label={t.home.stats.inProgress} className="text-state-progress" />
              <Stat href="/approvals" n={vm.stats.awaiting} label={t.home.stats.awaiting} className="text-amber-600" />
              <Stat href="/graph?critical=1" n={vm.stats.critical} label={t.home.stats.critical} className="text-state-critical" />
            </div>
            <p className="text-xs text-muted-foreground">{t.home.projectEnd(fmtDate(vm.projectEnd))}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t.home.byTrade}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {vm.byTrade.map((tr) => (
              <Link
                key={tr.id}
                href={`/tasks?state=ready&trade=${tr.id}`}
                className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tr.color }} />
                <span className="flex-1 truncate text-sm">{tr.name}</span>
                <span className="num font-bold">{tr.count}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Recommendation */}
      <Card className="border-state-ready/40 bg-state-ready/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-state-ready" />
            {t.home.recommendTitle}
          </CardTitle>
          <p className="text-sm">
            {t.home.recommendLine(vm.recommendation.tasks.length, vm.recommendation.unlocked)}
            {vm.recommendation.unlockedAfterLag > 0 && (
              <span className="text-muted-foreground"> · {t.home.unlocksAfterLag(vm.recommendation.unlockedAfterLag)}</span>
            )}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {vm.recommendation.tasks.map((task, i) => (
            <div key={task.id} className="flex items-center gap-2">
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-state-ready text-xs font-bold text-white">
                {i + 1}
              </span>
              <TaskRow task={task} unlocks={task.unlocks} className="flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Blockers that need YOU */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-state-blocked" />
            {t.home.needYouTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {vm.needYou.length === 0 && <p className="text-sm text-muted-foreground">{t.home.needYouEmpty}</p>}
          {vm.needYou.slice(0, 8).map((b) => (
            <NeedYouRow key={b.id} item={b} />
          ))}
        </CardContent>
      </Card>

      {/* Ask the project */}
      <Link
        href="/ask"
        className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-muted-foreground transition-colors hover:bg-accent"
      >
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="flex-1 text-sm">{t.home.askPlaceholder}</span>
        <ArrowLeft className="h-4 w-4" />
      </Link>

      {/* Ready list */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t.home.readyList}</h2>
          <Link href="/tasks?state=ready" className="text-sm text-primary hover:underline">
            {t.home.viewAll}
          </Link>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {vm.readyList.slice(0, 10).map((task) => (
            <TaskRow key={task.id} task={task} unlocks={task.unlocks} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, label, className, href }: { n: number; label: string; className?: string; href: string }) {
  return (
    <Link href={href} className="rounded-md bg-muted/60 px-1 py-2 transition-colors hover:bg-muted">
      <div className={cn("num text-xl font-bold", className)}>{n}</div>
      <div className="leading-tight text-muted-foreground">{label}</div>
    </Link>
  );
}

const KIND_ICON = {
  external: AlertTriangle,
  awaiting_approval: CheckCheck,
  manual: Hourglass,
  overdue: Flame,
  bottleneck: Unlock,
} as const;

function NeedYouRow({ item }: { item: NeedYouVM }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <Link href={item.href} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          item.kind === "external" ? "bg-state-blocked/15 text-state-blocked" : "bg-amber-100 text-amber-700",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium leading-snug">{item.line}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1.5 py-0">
            {item.kindLabel}
          </Badge>
          <UserRound className="h-3 w-3" />
          {item.who}
          {item.critical && (
            <Badge variant="critical" className="px-1.5 py-0">
              {t.tasks.onCriticalPath}
            </Badge>
          )}
        </span>
      </div>
      <span className="num text-2xl font-bold text-state-blocked">{item.blocksTransitive}</span>
    </Link>
  );
}
