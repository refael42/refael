"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/textarea";
import type { DependencySuggestion } from "@/lib/services/rules";
import { t } from "@/lib/i18n";
import { SuggestionsDialog, type SuggestionLabels } from "./suggestions-dialog";

export interface TaskFormOptions {
  areas: Option[];
  trades: Option[];
  contractors: Option[];
  /** trade id per contractor (auto-fill trade) */
  contractorTrade: Record<string, string | null>;
}

export interface TaskFormValues {
  title: string;
  description: string;
  area_id: string | null;
  trade_id: string | null;
  contractor_id: string | null;
  planned_start: string;
  planned_end: string;
  check_in_days: string;
  is_critical: boolean;
  status: "planned" | "in_progress";
}

const EMPTY: TaskFormValues = {
  title: "",
  description: "",
  area_id: null,
  trade_id: null,
  contractor_id: null,
  planned_start: "",
  planned_end: "",
  check_in_days: "",
  is_critical: false,
  status: "planned",
};

export function TaskFormDialog({
  options,
  taskId,
  initial,
  trigger,
  defaultAreaId,
}: {
  options: TaskFormOptions;
  taskId?: string;
  initial?: Partial<TaskFormValues>;
  trigger?: React.ReactNode;
  defaultAreaId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<TaskFormValues>({ ...EMPTY, area_id: defaultAreaId ?? null, ...initial });
  const [suggestions, setSuggestions] = useState<{ list: DependencySuggestion[]; labels: SuggestionLabels } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { call, pending } = useAction();
  const set = <K extends keyof TaskFormValues>(k: K, val: TaskFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (taskId) {
      const ok = await call(
        () =>
          updateTaskAction(taskId, {
            title: v.title,
            description: v.description || null,
            area_id: v.area_id,
            trade_id: v.trade_id,
            contractor_id: v.contractor_id,
            planned_start: v.planned_start || null,
            planned_end: v.planned_end || null,
            is_critical: v.is_critical,
          }),
        t.app.saved,
      );
      if (ok !== null) setOpen(false);
      return;
    }
    const res = await call(
      () =>
        createTaskAction({
          title: v.title,
          description: v.description || null,
          area_id: v.area_id,
          trade_id: v.trade_id,
          contractor_id: v.contractor_id,
          planned_start: v.planned_start || null,
          planned_end: v.planned_end || null,
          check_in_days: v.check_in_days ? Number(v.check_in_days) : null,
          is_critical: v.is_critical,
          status: v.status,
        }),
      t.tasks.created,
    );
    if (!res) return;
    setOpen(false);
    setV({ ...EMPTY, area_id: defaultAreaId ?? null });
    setCreatedId(res.taskId);
    if (res.suggestions.length) setSuggestions({ list: res.suggestions, labels: res.labels });
    else router.push(`/tasks/${res.taskId}`);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus />
              {t.tasks.newTask}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taskId ? t.app.edit : t.tasks.newTask}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label={t.tasks.taskTitle} htmlFor="title">
              <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.tasks.area}>
                <OptionSelect value={v.area_id} onChange={(x) => set("area_id", x)} options={options.areas} noneLabel={t.tasks.noArea} />
              </Field>
              <Field label={t.tasks.contractor}>
                <OptionSelect
                  value={v.contractor_id}
                  onChange={(x) => {
                    set("contractor_id", x);
                    if (x && !v.trade_id) set("trade_id", options.contractorTrade[x] ?? null);
                  }}
                  options={options.contractors}
                  noneLabel={t.tasks.noContractor}
                />
              </Field>
              <Field label={t.tasks.trade}>
                <OptionSelect value={v.trade_id} onChange={(x) => set("trade_id", x)} options={options.trades} noneLabel={t.tasks.noTrade} />
              </Field>
              {!taskId && (
                <Field label={t.tasks.checkInDays} htmlFor="check">
                  <Input id="check" type="number" min={0} inputMode="numeric" value={v.check_in_days} onChange={(e) => set("check_in_days", e.target.value)} />
                </Field>
              )}
              <Field label={t.tasks.plannedStart} htmlFor="ps">
                <Input id="ps" type="date" value={v.planned_start} onChange={(e) => set("planned_start", e.target.value)} />
              </Field>
              <Field label={t.tasks.plannedEnd} htmlFor="pe">
                <Input id="pe" type="date" value={v.planned_end} min={v.planned_start || undefined} onChange={(e) => set("planned_end", e.target.value)} />
              </Field>
            </div>
            <Field label={t.tasks.description} htmlFor="desc">
              <Textarea id="desc" value={v.description} onChange={(e) => set("description", e.target.value)} rows={2} />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={v.is_critical} onCheckedChange={(c) => set("is_critical", c)} />
                {t.tasks.critical}
              </label>
              {!taskId && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={v.status === "in_progress"} onCheckedChange={(c) => set("status", c ? "in_progress" : "planned")} />
                  {t.status.in_progress}
                </label>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !v.title.trim()}>
                {t.app.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {suggestions && (
        <SuggestionsDialog
          suggestions={suggestions.list}
          labels={suggestions.labels}
          onDone={() => {
            setSuggestions(null);
            if (createdId) router.push(`/tasks/${createdId}`);
          }}
        />
      )}
    </>
  );
}
