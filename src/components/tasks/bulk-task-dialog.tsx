"use client";
import { Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { bulkCreateTasksAction } from "@/app/actions/tasks";
import { Field, OptionSelect } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import type { DependencySuggestion } from "@/lib/services/rules";
import { t } from "@/lib/i18n";
import { SuggestionsDialog, type SuggestionLabels } from "./suggestions-dialog";
import type { TaskFormOptions } from "./task-form-dialog";

export interface AreaGroup {
  id: string;
  label: string;
  children: Array<{ id: string; label: string }>;
}

/** Create the same task in many apartments at once (e.g. "צבע" for every apartment on floor 3). */
export function BulkTaskDialog({ options, groups }: { options: TaskFormOptions; groups: AreaGroup[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState<string | null>(groups[0]?.id ?? null);
  const [picked, setPicked] = useState<Set<string>>(new Set(groups[0]?.children.map((c) => c.id) ?? []));
  const [trade, setTrade] = useState<string | null>(null);
  const [contractor, setContractor] = useState<string | null>(null);
  const [ps, setPs] = useState("");
  const [pe, setPe] = useState("");
  const [followUp, setFollowUp] = useState<{ list: DependencySuggestion[]; labels: SuggestionLabels } | null>(null);
  const { call, pending } = useAction();
  const children = useMemo(() => groups.find((g) => g.id === group)?.children ?? [], [groups, group]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Layers />
        {t.bulk.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.bulk.title}</DialogTitle>
            <DialogDescription>{t.bulk.hint}</DialogDescription>
          </DialogHeader>
          <Field label={t.tasks.taskTitle}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.bulk.titlePlaceholder} autoFocus />
          </Field>
          <Field label={t.bulk.where}>
            <OptionSelect
              value={group}
              onChange={(v) => {
                setGroup(v);
                setPicked(new Set(groups.find((g) => g.id === v)?.children.map((c) => c.id) ?? []));
              }}
              options={groups.map((g) => ({ value: g.id, label: g.label }))}
            />
          </Field>
          <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
            {children.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={picked.has(c.id)}
                  onCheckedChange={(v) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (v) n.add(c.id);
                      else n.delete(c.id);
                      return n;
                    })
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.tasks.contractor}>
              <OptionSelect
                value={contractor}
                onChange={(v) => {
                  setContractor(v);
                  if (v && !trade) setTrade(options.contractorTrade[v] ?? null);
                }}
                options={options.contractors}
                noneLabel={t.tasks.noContractor}
              />
            </Field>
            <Field label={t.tasks.trade}>
              <OptionSelect value={trade} onChange={setTrade} options={options.trades} noneLabel={t.tasks.noTrade} />
            </Field>
            <Field label={t.tasks.plannedStart}>
              <Input type="date" value={ps} onChange={(e) => setPs(e.target.value)} />
            </Field>
            <Field label={t.tasks.plannedEnd}>
              <Input type="date" value={pe} min={ps || undefined} onChange={(e) => setPe(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !title.trim() || picked.size === 0}
              onClick={async () => {
                const res = await call(
                  () =>
                    bulkCreateTasksAction({
                      title,
                      areaIds: children.filter((c) => picked.has(c.id)).map((c) => c.id),
                      trade_id: trade,
                      contractor_id: contractor,
                      planned_start: ps || null,
                      planned_end: pe || null,
                    }),
                  (r) => t.bulk.created(r.count),
                );
                if (res) {
                  setOpen(false);
                  setTitle("");
                  if (res.suggestions.length) setFollowUp({ list: res.suggestions, labels: res.labels });
                }
              }}
            >
              {t.bulk.create(picked.size)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {followUp && <SuggestionsDialog suggestions={followUp.list} labels={followUp.labels} onDone={() => setFollowUp(null)} />}
    </>
  );
}
