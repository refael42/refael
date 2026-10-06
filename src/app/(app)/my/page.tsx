import { CalendarDays, ChevronLeft, Hourglass, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportDoneButton } from "@/components/completion/report-done-button";
import { StartButton } from "@/components/my/start-button";
import { StateBadge } from "@/components/tasks/state-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { fmtChatTime, fmtDate, t } from "@/lib/i18n";
import { listConversations } from "@/lib/services/chat";
import { requireProjectSession } from "@/lib/services/session";
import { loadSnapshot } from "@/lib/services/snapshot";
import { describeBlocking, taskCard, type TaskCardVM } from "@/lib/services/views";
import { cn } from "@/lib/utils";

export const metadata = { title: t.my.title };

export default async function MyTasksPage() {
  const s = await requireProjectSession();
  if (s.role !== "contractor") redirect("/");
  const store = getStore();
  const snap = await loadSnapshot(store, s.project.id);
  const mine = snap.tasks.filter((x) => x.contractor_id && s.contractorIds.includes(x.contractor_id));
  const weekAgo = new Date(snap.now.getTime() - 7 * 86_400_000).toISOString();

  const cards = mine.map((x) => ({
    ...taskCard(snap, x.id),
    waitingFor: snap.analysis.byTask[x.id].rootBlockers.map((b) => describeBlocking(snap, b)),
    completedAt: x.completed_at,
    plannedStart: x.planned_start,
  }));
  const ready = cards.filter((c) => c.state === "ready");
  const inProgress = cards.filter((c) => c.state === "in_progress");
  const awaiting = cards.filter((c) => c.state === "awaiting_approval");
  const waiting = cards.filter((c) => c.state === "blocked");
  const done = cards.filter((c) => c.state === "done" && (c.completedAt ?? "") >= weekAgo);
  const chats = (await listConversations(store, s)).slice(0, 4);
  const firstName = s.profile.full_name.split(/\s+/)[0];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 p-4">
      <div>
        <p className="text-sm text-muted-foreground">{t.my.hello(firstName)}</p>
        <h1 className="text-2xl font-bold">{t.my.title}</h1>
        <div className="mt-2 flex gap-2 text-sm">
          <Badge variant="ready">{`${t.my.readyNow}: ${ready.length}`}</Badge>
          <Badge variant="in_progress">{`${t.my.inProgress}: ${inProgress.length}`}</Badge>
          <Badge variant="blocked">{`${t.my.waiting}: ${waiting.length}`}</Badge>
        </div>
      </div>

      {ready.length + inProgress.length + awaiting.length + waiting.length === 0 && (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">{t.my.nothing}</p>
      )}

      <Section title={t.my.inProgress} items={inProgress} tone="progress">
        {(c) => <ReportDoneButton taskId={c.id} taskTitle={c.title} size="lg" className="flex-1" />}
      </Section>

      <Section title={t.my.readyNow} items={ready} tone="ready">
        {(c) => (
          <>
            <StartButton taskId={c.id} />
            <ReportDoneButton taskId={c.id} taskTitle={c.title} size="lg" className="flex-1" />
          </>
        )}
      </Section>

      <Section title={t.my.awaiting} items={awaiting} tone="approval" />

      {waiting.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t.my.waiting}</h2>
          {waiting.map((c) => (
            <Link key={c.id} href={`/tasks/${c.id}`} className="flex flex-col gap-1.5 rounded-lg border p-3 opacity-90 hover:bg-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.title}</span>
                <StateBadge state="blocked" />
              </div>
              <span className="text-xs text-muted-foreground">{c.area}</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-state-blocked">{t.my.waitingFor}</span>
                {c.waitingFor.map((w, i) => (
                  <span key={i} className="flex flex-wrap items-center gap-1 text-xs">
                    <Hourglass className="h-3 w-3 text-state-blocked" />
                    {w.text}
                    <span className="flex items-center gap-0.5 text-muted-foreground">
                      · <UserRound className="h-3 w-3" /> {w.who}
                    </span>
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      )}

      {done.length > 0 && <Section title={t.my.doneRecently} items={done} tone="done" />}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t.my.myChats}</h2>
        {chats.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{c.title}</span>
              <span className="truncate text-xs text-muted-foreground">{c.lastText}</span>
            </div>
            <span className="text-xs text-muted-foreground">{c.lastAt ? fmtChatTime(c.lastAt) : ""}</span>
            {c.unread > 0 && (
              <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-state-ready px-1 text-[11px] font-bold text-white">{c.unread}</span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  children,
}: {
  title: string;
  items: Array<TaskCardVM & { plannedStart: string | null }>;
  tone: "ready" | "progress" | "approval" | "done";
  children?: (c: TaskCardVM) => React.ReactNode;
}) {
  if (!items.length) return null;
  const border = { ready: "border-s-state-ready", progress: "border-s-state-progress", approval: "border-s-state-approval", done: "border-s-state-done" }[tone];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h2>
      {items.map((c) => (
        <Card key={c.id} className={cn("border-s-4", border)}>
          <CardContent className="flex flex-col gap-3 p-4">
            <Link href={`/tasks/${c.id}`} className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold leading-snug">{c.title}</span>
                <span className="text-sm text-muted-foreground">{c.area}</span>
                {(c.plannedEnd || c.plannedStart) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate(c.plannedStart)} – {fmtDate(c.plannedEnd)}
                    {c.overdue && <Badge variant="blocked" className="ms-1 px-1.5 py-0">{t.tasks.overdue}</Badge>}
                  </span>
                )}
              </div>
              <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            {children && <div className="flex gap-2">{children(c)}</div>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
