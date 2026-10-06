"use client";
import { ArrowDown, Check, CheckCircle2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { approveSuggestionAction, dismissSuggestionAction } from "@/app/actions/ai";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { SuggestionsDialog, type SuggestionLabels } from "@/components/tasks/suggestions-dialog";
import type { TaskFormOptions } from "@/components/tasks/task-form-dialog";
import { TaskPicker } from "@/components/tasks/task-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AiParsedJson, AiStatus } from "@/lib/db/types";
import { t } from "@/lib/i18n";
import type { ApproveEdits } from "@/lib/services/ai-suggestions";
import type { DependencySuggestion } from "@/lib/services/rules";
import { cn } from "@/lib/utils";

type EditTask = NonNullable<ApproveEdits["tasks"]>[number];

function initialTasks(ai: AiParsedJson): EditTask[] {
  return ai.tasks.map((x, i) => ({
    title: x.title,
    area_id: ai.resolved?.tasks[i]?.area_id ?? null,
    contractor_id: ai.resolved?.tasks[i]?.contractor_id ?? null,
    trade_id: ai.resolved?.tasks[i]?.trade_id ?? null,
    status: x.status,
    check_in_days: x.check_in_days,
    depends_on_index: x.depends_on_index,
  }));
}

export function AiCard({
  messageId,
  ai,
  status,
  mine,
  isPM,
  options,
  taskOptions,
}: {
  messageId: string;
  ai: AiParsedJson;
  status: AiStatus;
  mine: boolean;
  isPM: boolean;
  options: TaskFormOptions | null;
  taskOptions: Option[];
}) {
  const { call, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [followUp, setFollowUp] = useState<{ list: DependencySuggestion[]; labels: SuggestionLabels } | null>(null);
  const label = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of [...(options?.areas ?? []), ...(options?.contractors ?? []), ...(options?.trades ?? []), ...taskOptions]) m.set(o.value, o.label);
    return (id: string | null | undefined) => (id ? m.get(id) ?? null : null);
  }, [options, taskOptions]);

  const tasks = initialTasks(ai);
  const affects = ai.resolved?.affects_task_ids ?? [];
  const completes = ai.resolved?.completes_task_id ?? null;
  const title = ai.intent === "new_task" && ai.tasks.length > 1 ? t.ai.cardTitle.new_tasks : t.ai.cardTitle[ai.intent];

  async function approve(edits?: ApproveEdits) {
    const res = await call(() => approveSuggestionAction(messageId, edits), (r) =>
      r.released ? `${t.ai.approved} · ${t.completion.releasedN(r.released)}` : t.ai.approved,
    );
    if (res) {
      setEditing(false);
      if (res.suggestions.length) setFollowUp({ list: res.suggestions, labels: res.labels });
    }
  }

  return (
    <div
      className={cn(
        "mb-1 flex w-[min(92%,26rem)] flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/90 p-3 text-sm shadow-sm dark:border-violet-900 dark:bg-violet-950/60",
        mine ? "self-end" : "self-start",
        status === "accepted" && "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40",
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <span className="font-semibold">{title}</span>
        <span className="ms-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {ai.engine === "claude" ? t.ai.engineClaude : t.ai.engineHeuristic} · {t.ai.confidence(ai.confidence)}
        </span>
      </div>

      {ai.intent === "new_task" && (
        <ol className="flex flex-col gap-1.5">
          {tasks.map((task, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              {i > 0 && task.depends_on_index !== null && <ArrowDown className="h-3.5 w-3.5 self-center text-violet-500" />}
              <div className="rounded-md bg-background/80 px-2 py-1.5">
                <div className="font-medium">{task.title}</div>
                <div className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                  <span>{label(task.area_id) ?? ai.tasks[i].area ?? t.tasks.noArea}</span>
                  <span>· {label(task.contractor_id) ?? ai.tasks[i].contractor ?? t.tasks.noContractor}</span>
                  {task.status && <span>· {t.status[task.status]}</span>}
                  {task.check_in_days ? <span>· {t.ai.checkIn(task.check_in_days)}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {ai.intent === "completion_report" && (
        <div className="rounded-md bg-background/80 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">{t.ai.completes}: </span>
          <span className="font-medium">{label(completes) ?? t.ai.noMatch}</span>
        </div>
      )}
      {ai.intent === "blocker" && (
        <div className="rounded-md bg-background/80 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">{t.ai.blockerText}: </span>
          <span className="font-medium">{ai.blocker_text}</span>
        </div>
      )}
      {ai.intent === "question" && <p className="text-xs text-muted-foreground">{t.ai.questionHint}</p>}
      {ai.intent === "decision" && <p className="text-xs text-muted-foreground">{t.ai.decisionHint}</p>}

      {affects.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">{t.ai.affects}:</span>
          {affects.map((id) => (
            <Badge key={id} variant="outline" className="bg-background">
              {label(id) ?? id.slice(0, 6)}
            </Badge>
          ))}
        </div>
      )}

      {status === "accepted" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {t.ai.approved}
          {ai.applied?.task_ids?.map((id, i) => (
            <Link key={id} href={`/tasks/${id}`} className="underline">
              {ai.tasks[i]?.title ?? id.slice(0, 6)}
            </Link>
          ))}
          {completes && ai.intent === "completion_report" && (
            <Link href={`/tasks/${completes}`} className="underline">
              {label(completes) ?? ""}
            </Link>
          )}
        </div>
      ) : isPM ? (
        <div className="flex gap-2">
          <Button size="sm" variant="success" disabled={pending} onClick={() => approve()}>
            <Check />
            {ai.intent === "question" || ai.intent === "decision" ? t.ai.markHandled : t.ai.approve}
          </Button>
          {options && (ai.intent === "new_task" || ai.intent === "completion_report" || ai.intent === "blocker") && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)}>
              <Pencil />
              {t.ai.edit}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => call(() => dismissSuggestionAction(messageId), t.ai.dismissed)}>
            <X />
            {t.ai.dismiss}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.ai.onlyPm}</p>
      )}

      {editing && options && (
        <EditDialog
          ai={ai}
          initial={{ tasks, affects, completes, blockerText: ai.blocker_text ?? "" }}
          options={options}
          taskOptions={taskOptions}
          pending={pending}
          onClose={() => setEditing(false)}
          onApprove={approve}
        />
      )}
      {followUp && <SuggestionsDialog suggestions={followUp.list} labels={followUp.labels} onDone={() => setFollowUp(null)} />}
    </div>
  );
}

function EditDialog({
  ai,
  initial,
  options,
  taskOptions,
  pending,
  onClose,
  onApprove,
}: {
  ai: AiParsedJson;
  initial: { tasks: EditTask[]; affects: string[]; completes: string | null; blockerText: string };
  options: TaskFormOptions;
  taskOptions: Option[];
  pending: boolean;
  onClose: () => void;
  onApprove: (edits: ApproveEdits) => void;
}) {
  const [tasks, setTasks] = useState<EditTask[]>(initial.tasks);
  const [affects, setAffects] = useState<string[]>(initial.affects);
  const [completes, setCompletes] = useState<string | null>(initial.completes);
  const [blockerText, setBlockerText] = useState(initial.blockerText);
  const [blockerOwner, setBlockerOwner] = useState("");
  const setTask = (i: number, patch: Partial<EditTask>) => setTasks((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const statusOptions: Option[] = (["planned", "in_progress", "done"] as const).map((s) => ({ value: s, label: t.status[s] }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.ai.editTitle}</DialogTitle>
          {ai.intent === "new_task" && tasks.length > 1 && <DialogDescription>{t.ai.chainHint}</DialogDescription>}
        </DialogHeader>

        {ai.intent === "new_task" && (
          <div className="flex flex-col gap-3">
            {tasks.map((task, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{i + 1}</span>
                  <Input value={task.title} onChange={(e) => setTask(i, { title: e.target.value })} />
                  {tasks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.ai.removeTask}
                      onClick={() =>
                        setTasks((p) =>
                          p
                            .filter((_, j) => j !== i)
                            .map((x) => ({
                              ...x,
                              depends_on_index:
                                x.depends_on_index === null || x.depends_on_index === i ? null : x.depends_on_index > i ? x.depends_on_index - 1 : x.depends_on_index,
                            })),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <Field label={t.tasks.area}>
                    <OptionSelect value={task.area_id} onChange={(v) => setTask(i, { area_id: v })} options={options.areas} noneLabel={t.tasks.noArea} />
                  </Field>
                  <Field label={t.tasks.contractor}>
                    <OptionSelect
                      value={task.contractor_id}
                      onChange={(v) => setTask(i, { contractor_id: v, trade_id: task.trade_id ?? (v ? options.contractorTrade[v] ?? null : null) })}
                      options={options.contractors}
                      noneLabel={t.tasks.noContractor}
                    />
                  </Field>
                  <Field label={t.tasks.trade}>
                    <OptionSelect value={task.trade_id} onChange={(v) => setTask(i, { trade_id: v })} options={options.trades} noneLabel={t.tasks.noTrade} />
                  </Field>
                  <Field label={t.tasks.state}>
                    <OptionSelect value={task.status ?? "planned"} onChange={(v) => setTask(i, { status: (v as EditTask["status"]) ?? "planned" })} options={statusOptions} />
                  </Field>
                  <Field label={t.tasks.checkInDays}>
                    <Input
                      type="number"
                      min={0}
                      value={task.check_in_days ?? ""}
                      onChange={(e) => setTask(i, { check_in_days: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  {i > 0 && (
                    <Field label={t.ai.dependsOn}>
                      <OptionSelect
                        value={task.depends_on_index === null ? null : String(task.depends_on_index)}
                        onChange={(v) => setTask(i, { depends_on_index: v === null ? null : Number(v) })}
                        options={tasks.slice(0, i).map((x, j) => ({ value: String(j), label: `${j + 1}. ${x.title}` }))}
                        noneLabel={t.app.none}
                      />
                    </Field>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setTasks((p) => [
                  ...p,
                  { title: "", area_id: p.at(-1)?.area_id ?? null, contractor_id: null, trade_id: null, status: "planned", check_in_days: null, depends_on_index: p.length - 1 },
                ])
              }
            >
              <Plus />
              {t.ai.addTask}
            </Button>
          </div>
        )}

        {ai.intent === "completion_report" && (
          <Field label={t.ai.completes}>
            <TaskPicker items={taskOptions} value={completes} onChange={setCompletes} />
          </Field>
        )}

        {ai.intent === "blocker" && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t.overview.blockerTitle}>
              <Input value={blockerText} onChange={(e) => setBlockerText(e.target.value)} />
            </Field>
            <Field label={t.overview.blockerOwner}>
              <Input value={blockerOwner} onChange={(e) => setBlockerOwner(e.target.value)} />
            </Field>
          </div>
        )}

        {(ai.intent === "new_task" || ai.intent === "blocker") && (
          <Field label={`${t.ai.affects} (${affects.length})`}>
            <TaskPicker
              items={taskOptions.map((o) => ({ ...o, label: affects.includes(o.value) ? `✓ ${o.label}` : o.label }))}
              value={null}
              onChange={(v) => setAffects((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
            />
          </Field>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t.app.cancel}
          </Button>
          <Button
            variant="success"
            disabled={pending || (ai.intent === "new_task" && tasks.some((x) => !x.title.trim())) || (ai.intent === "completion_report" && !completes)}
            onClick={() =>
              onApprove({
                tasks: ai.intent === "new_task" ? tasks : undefined,
                affects_task_ids: affects,
                completes_task_id: completes,
                blocker_text: blockerText,
                blocker_owner: blockerOwner || null,
              })
            }
          >
            <Check />
            {t.ai.approveAndCreate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
