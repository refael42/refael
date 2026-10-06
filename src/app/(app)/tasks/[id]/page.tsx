import { ArrowRight, CalendarDays, Clock, Flame, History, Image as ImageIcon, MapPin, MessageCircle, Unlock, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddDependencyDialog, RemoveDependencyButton } from "@/components/tasks/dependency-editor";
import { StateBadge } from "@/components/tasks/state-badge";
import { TaskActions } from "@/components/tasks/task-actions";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { fmtDate, fmtDateTime, t } from "@/lib/i18n";
import { mediaSrc } from "@/lib/media";
import { canSeeTask, isPM, isStaff } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, areasOverlap, loadSnapshot } from "@/lib/services/snapshot";
import { taskDetailView } from "@/lib/services/task-detail";
import { formOptions, type BlockerLineVM } from "@/lib/services/views";
import { cn } from "@/lib/utils";
import { ReportDoneButton } from "@/components/completion/report-done-button";
import { PinPicker } from "@/components/plans/pin-picker";

export default async function TaskPage({ params }: { params: { id: string } }) {
  const s = await requireProjectSession();
  const store = getStore();
  const snap = await loadSnapshot(store, s.project.id);
  const task = snap.taskById.get(params.id);
  if (!task || !canSeeTask(s, task)) notFound();
  const vm = await taskDetailView(store, s, snap, task.id);
  const pm = isPM(s);
  const staff = isStaff(s);
  const own = !!task.contractor_id && s.contractorIds.includes(task.contractor_id);
  const pending = vm.reports.some((r) => r.status === "pending");

  const pickTasks = snap.tasks
    .filter((x) => x.id !== task.id)
    .map((x) => ({ value: x.id, label: x.title, hint: areaLabel(snap.areaById, x.area_id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "he", { numeric: true }));
  const pickBlockers = snap.blockers.map((b) => ({ value: b.id, label: b.title, hint: b.owner_name ?? undefined }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <Link href={pm ? "/tasks" : "/my"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" />
        {t.app.back}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {vm.areaPath.map((a, i) => (
            <span key={a.id} className="flex items-center gap-2">
              {i > 0 && <span>›</span>}
              {staff ? (
                <Link href={`/areas/${a.id}`} className="hover:underline">
                  {a.name}
                </Link>
              ) : (
                a.name
              )}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-bold leading-tight">{vm.card.title}</h1>
          <div className="flex items-center gap-2">
            <StateBadge state={vm.card.state} className="text-sm" />
            {pm && (
              <TaskFormDialog
                options={formOptions(snap)}
                taskId={task.id}
                initial={{
                  title: task.title,
                  description: task.description ?? "",
                  area_id: task.area_id,
                  trade_id: task.trade_id,
                  contractor_id: task.contractor_id,
                  planned_start: task.planned_start ?? "",
                  planned_end: task.planned_end ?? "",
                  is_critical: task.is_critical,
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    {t.app.edit}
                  </Button>
                }
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: vm.card.tradeColor }} />
            {vm.card.trade ?? t.tasks.noTrade}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <UserRound className="h-4 w-4" />
            {vm.contractorLabel}
          </span>
          {(vm.isCriticalFlag || vm.onCriticalPath) && (
            <Badge variant="critical">
              <Flame className="h-3 w-3" />
              {vm.onCriticalPath ? t.tasks.onCriticalPath : t.tasks.critical}
            </Badge>
          )}
          {vm.card.overdue && <Badge variant="blocked">{t.tasks.overdue}</Badge>}
          {vm.card.outOfOrder && <Badge variant="awaiting_approval">{t.blocking.outOfOrder}</Badge>}
          {pending && <Badge variant="awaiting_approval">{t.status.awaiting_approval}</Badge>}
        </div>
        {vm.description && <p className="text-sm text-muted-foreground">{vm.description}</p>}
      </div>

      <TaskActions
        taskId={task.id}
        status={task.status}
        role={s.role}
        isOwnTask={own}
        reportSlot={(own || pm) && task.status !== "done" && task.status !== "awaiting_approval" ? <ReportDoneButton taskId={task.id} taskTitle={task.title} /> : null}
      />

      {/* Why blocked */}
      {(vm.card.state === "blocked" || vm.blockedBy.length > 0) && (
        <Card className="border-state-blocked/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-state-blocked">{t.blocking.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {vm.blockedBy.map((b, i) => (
              <BlockerLine key={i} line={b} />
            ))}
            {vm.rootBlockers.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{t.blocking.rootCause}</p>
                {vm.rootBlockers.map((b, i) => (
                  <BlockerLine key={`r${i}`} line={b} />
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}
      {vm.card.state === "ready" && (
        <p className="rounded-md bg-state-ready/10 p-3 text-sm text-state-ready">{t.blocking.noBlockers}</p>
      )}

      {/* Impact */}
      {staff && (vm.card.blocksTransitive > 0 || vm.unlockIfDone) && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <span className="flex items-center gap-1 font-medium">
              <Unlock className="h-4 w-4 text-state-ready" />
              {t.tasks.impact}
            </span>
            <span>{t.blocking.blocksCount(vm.card.blocksDirect, vm.card.blocksTransitive)}</span>
            {vm.unlockIfDone && <span className="text-state-ready">{t.tasks.unlockIfDone(vm.unlockIfDone.immediate)}</span>}
            {vm.unlockIfDone && vm.unlockIfDone.afterLag > 0 && (
              <span className="text-muted-foreground">{t.home.unlocksAfterLag(vm.unlockIfDone.afterLag)}</span>
            )}
            {vm.card.state !== "done" && <span className="text-muted-foreground">{t.tasks.slack(String(vm.slackDays))}</span>}
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          <DateItem icon={CalendarDays} label={t.tasks.plannedStart} value={fmtDate(vm.plannedStart)} />
          <DateItem icon={CalendarDays} label={t.tasks.plannedEnd} value={fmtDate(vm.plannedEnd)} />
          <DateItem icon={Clock} label={t.tasks.checkAt} value={fmtDateTime(vm.checkAt)} />
          <DateItem
            icon={Clock}
            label={vm.completedAt ? t.tasks.completed : t.tasks.started}
            value={fmtDateTime(vm.completedAt ?? vm.startedAt)}
          />
        </CardContent>
      </Card>

      {/* Graph neighbours (staff only — contractors see just the reasons above) */}
      {staff && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>{t.tasks.predecessors}</CardTitle>
              {pm && <AddDependencyDialog taskId={task.id} tasks={pickTasks} blockers={pickBlockers} />}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {vm.predecessors.length === 0 && <p className="text-sm text-muted-foreground">{t.app.none}</p>}
              {vm.predecessors.map((p) => (
                <div key={p.depId} className="flex items-center gap-1">
                  {p.kind === "task" ? (
                    <TaskRow task={p.task} showReason={false} className="flex-1" />
                  ) : (
                    <Link
                      href={`/overview#blocker-${p.blocker.id}`}
                      className={cn(
                        "flex flex-1 flex-col rounded-lg border p-3 text-sm",
                        p.blocker.status === "open" ? "border-state-blocked/40 bg-state-blocked/5" : "opacity-60",
                      )}
                    >
                      <span className="font-medium">{t.blocking.external(p.blocker.title)}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.blocker.owner} · {p.blocker.status === "open" ? t.overview.open : t.overview.resolved}
                      </span>
                    </Link>
                  )}
                  {p.lagHours > 0 && <Badge variant="outline">{`+${p.lagHours}h`}</Badge>}
                  {pm && <RemoveDependencyButton depId={p.depId} />}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t.tasks.successors}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {vm.successors.length === 0 && <p className="text-sm text-muted-foreground">{t.app.none}</p>}
              {vm.successors.map((x) => (
                <div key={x.depId} className="flex items-center gap-1">
                  <TaskRow task={x.task} showReason={false} className="flex-1" />
                  {x.lagHours > 0 && <Badge variant="outline">{`+${x.lagHours}h`}</Badge>}
                  {pm && <RemoveDependencyButton depId={x.depId} />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Photos / completion reports */}
      {vm.reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              {t.tasks.photos}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {vm.reports.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={r.status === "approved" ? "ready" : r.status === "rejected" ? "blocked" : "awaiting_approval"}>
                    {r.status === "approved" ? t.completion.approve : r.status === "rejected" ? t.completion.reject : t.status.awaiting_approval}
                  </Badge>
                  {r.submitter && `${t.completion.by} ${r.submitter}`} · {fmtDateTime(r.created_at)}
                </div>
                {r.note && <p className="text-sm">{r.note}</p>}
                <div className="flex gap-2 overflow-x-auto">
                  {r.photo_urls.map((u) => (
                    <a key={u} href={mediaSrc(u)} target="_blank" rel="noreferrer">
                      <img src={mediaSrc(u)} alt="" className="h-28 w-28 shrink-0 rounded-md border object-cover" />
                    </a>
                  ))}
                </div>
                {r.review_comment && <p className="text-xs text-muted-foreground">↩ {r.review_comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linked messages */}
      {vm.messages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {t.tasks.messages}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {vm.messages.map((m) => (
              <Link
                key={m.id}
                href={`/chat/${m.conversationId}#m-${m.id}`}
                className="flex flex-col gap-0.5 rounded-md border p-3 text-sm hover:bg-accent"
              >
                <span className="text-xs text-muted-foreground">
                  {m.sender} · {fmtDateTime(m.at)}
                </span>
                {m.kind === "image" && m.mediaUrl ? (
                  <img src={mediaSrc(m.mediaUrl)} alt="" className="h-20 w-20 rounded object-cover" />
                ) : (
                  <span>{m.text}</span>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plan pin */}
      {staff && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">{t.tasks.planPin}:</span>
            {vm.pin ? (
              <Link href={`/plans/${vm.pin.planId}?pin=${task.plan_pin_id}`} className="text-primary hover:underline">
                {vm.pin.planTitle}
              </Link>
            ) : (
              !pm && <span className="text-muted-foreground">{t.tasks.noPin}</span>
            )}
            {pm && <PinPicker taskId={task.id} value={task.plan_pin_id} pins={await pinOptions(store, snap, task.area_id)} />}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {staff && vm.history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t.tasks.history}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 border-s ps-4 text-sm">
              {vm.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -start-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
                  <span>{h.text}</span>
                  <span className="block text-xs text-muted-foreground">
                    {fmtDateTime(h.at)} · {h.actor ?? t.chat.system} · {t.tasks.source[h.source]}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BlockerLine({ line }: { line: BlockerLineVM }) {
  const inner = (
    <>
      <span className="font-medium">{line.text}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <UserRound className="h-3 w-3" />
        {t.blocking.whoMustAct}: {line.who}
      </span>
    </>
  );
  const cls = "flex flex-col gap-0.5 rounded-md border border-state-blocked/30 bg-state-blocked/5 p-3 text-sm";
  return line.href ? (
    <Link href={line.href} className={cn(cls, "hover:bg-state-blocked/10")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function DateItem({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}

/** Pins on the project's plans; those in the task's area (or around it) first. */
async function pinOptions(store: ReturnType<typeof getStore>, snap: Awaited<ReturnType<typeof loadSnapshot>>, areaId: string | null) {
  const plans = await store.select("plan_files", { where: { project_id: snap.project.id } });
  if (!plans.length) return [];
  const pins = await store.select("plan_pins", { where: { plan_file_id: { in: plans.map((p) => p.id) } } });
  const related = (a: string | null) => !!a && !!areaId && areasOverlap(snap.areaById, a, areaId);
  return pins
    .map((p) => ({
      value: p.id,
      label: `${plans.find((f) => f.id === p.plan_file_id)?.title ?? ""} · ${p.label ?? (p.area_id ? snap.areaById.get(p.area_id)?.name : "") ?? ""}`,
      rel: related(p.area_id),
    }))
    .sort((a, b) => Number(b.rel) - Number(a.rel) || a.label.localeCompare(b.label, "he", { numeric: true }))
    .map(({ value, label }) => ({ value, label }));
}
