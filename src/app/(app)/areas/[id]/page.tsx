import { ArrowRight, MapPin, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AreaTile } from "@/components/overview/area-tile";
import { StateBadge } from "@/components/tasks/state-badge";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getStore } from "@/lib/db";
import type { EffectiveState } from "@/lib/engine/types";
import { fmtDateTime, t } from "@/lib/i18n";
import { isPM } from "@/lib/services/access";
import { areaBlockers, areaBreadcrumb, areaMessages } from "@/lib/services/area-view";
import { requireProjectSession } from "@/lib/services/session";
import { areaSubtree, loadSnapshot } from "@/lib/services/snapshot";
import { areaProgress, findArea, formOptions, taskCard } from "@/lib/services/views";

const ORDER: EffectiveState[] = ["in_progress", "ready", "awaiting_approval", "blocked", "done"];

export default async function AreaPage({ params }: { params: { id: string } }) {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const store = getStore();
  const snap = await loadSnapshot(store, s.project.id);
  const area = snap.areaById.get(params.id);
  if (!area) notFound();

  const progress = findArea(areaProgress(snap), area.id)!;
  const inArea = areaSubtree(snap.areas, area.id);
  const cards = snap.tasks.filter((x) => x.area_id && inArea.has(x.area_id)).map((x) => taskCard(snap, x.id));
  const blockers = areaBlockers(snap, area.id);
  const [messages, pins] = await Promise.all([
    areaMessages(store, s, snap, area.id),
    store.select("plan_pins", { where: { area_id: area.id } }),
  ]);
  const senders = new Map(snap.profiles.map((p) => [p.id, p.full_name]));
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/overview" className="flex items-center gap-1 hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          {t.nav.overview}
        </Link>
        {areaBreadcrumb(snap, area.id).map((a) => (
          <span key={a.id}>
            ›{" "}
            <Link href={`/areas/${a.id}`} className="hover:underline">
              {a.name}
            </Link>
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{area.name}</h1>
        {isPM(s) && <TaskFormDialog options={formOptions(snap)} defaultAreaId={area.id} />}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>{t.overview.doneOf(progress.done, progress.total)}</span>
            <span className="num font-bold">{pct}%</span>
          </div>
          <Progress value={pct} />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-state-ready">{`${t.home.stats.ready}: ${progress.ready}`}</span>
            <span className="text-state-blocked">{`${t.home.stats.blocked}: ${progress.blocked}`}</span>
            <span className="text-state-progress">{`${t.home.stats.inProgress}: ${progress.inProgress}`}</span>
            <span className="text-amber-600">{`${t.home.stats.awaiting}: ${progress.awaiting}`}</span>
          </div>
        </CardContent>
      </Card>

      {blockers.length > 0 && (
        <Card className="border-state-blocked/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-state-blocked">{t.area.blockersHere}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {blockers.map((b) => (
              <Link key={b.key} href={b.href ?? "#"} className="flex items-center gap-3 rounded-md border border-state-blocked/30 bg-state-blocked/5 p-3 text-sm hover:bg-state-blocked/10">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium">{b.text}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" />
                    {t.blocking.whoMustAct}: {b.who}
                  </span>
                </div>
                <span className="num text-xl font-bold text-state-blocked">{b.count}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {progress.children.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t.area.childAreas}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {progress.children.map((c) => (
              <AreaTile key={c.id} area={c} compact />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t.area.tasksHere}</h2>
        {cards.length === 0 && <p className="text-sm text-muted-foreground">{t.tasks.empty}</p>}
        {ORDER.map((st) => {
          const list = cards.filter((c) => c.state === st);
          if (!list.length) return null;
          return (
            <div key={st} className="flex flex-col gap-2">
              <StateBadge state={st} className="self-start" />
              <div className="grid gap-2 md:grid-cols-2">
                {list.map((c) => (
                  <TaskRow key={c.id} task={c} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {pins.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">{t.area.onPlans}:</span>
            {pins.map((p) => (
              <Link key={p.id} href={`/plans/${p.plan_file_id}?pin=${p.id}`} className="text-primary hover:underline">
                {p.label ?? area.name}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {messages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {t.area.relatedMessages}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {messages.map((m) => (
              <Link key={m.id} href={`/chat/${m.conversation_id}#m-${m.id}`} className="flex flex-col gap-0.5 rounded-md border p-3 text-sm hover:bg-accent">
                <span className="text-xs text-muted-foreground">
                  {m.sender_profile_id ? senders.get(m.sender_profile_id) ?? "" : t.chat.system} · {fmtDateTime(m.created_at)}
                </span>
                <span>{m.text}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
