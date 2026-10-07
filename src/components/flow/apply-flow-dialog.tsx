"use client";
import { Workflow } from "lucide-react";
import { useState } from "react";
import { applyFlowAction } from "@/app/actions/flow";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FlowKind } from "@/lib/flow/process";
import { t } from "@/lib/i18n";
import { AreaPicker } from "./area-picker";

const AUTO = "__auto__";

export function ApplyFlowDialog({
  groups,
  trades,
  contractorsByTrade,
  defaultStart,
  kind = "apartment",
}: {
  kind?: FlowKind;
  groups: AreaGroup[];
  trades: Array<{ key: string; name: string }>;
  contractorsByTrade: Record<string, Option[]>;
  defaultStart: string;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [start, setStart] = useState(defaultStart);
  const [stagger, setStagger] = useState("0");
  const [who, setWho] = useState<Record<string, string>>({});
  const { call, pending } = useAction();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Workflow />
        {kind === "building" ? t.flow.applyBuilding : t.flow.apply}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{kind === "building" ? t.flow.applyBuildingTitle : t.flow.applyTitle}</DialogTitle>
            <DialogDescription>{kind === "building" ? t.flow.applyBuildingHint : t.flow.applyHint}</DialogDescription>
          </DialogHeader>
          <AreaPicker groups={groups} picked={picked} onChange={setPicked} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.flow.startDate}>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t.flow.stagger}>
              <Input type="number" min={0} value={stagger} onChange={(e) => setStagger(e.target.value)} />
            </Field>
          </div>
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer text-sm font-medium">{t.flow.contractorPerTrade}</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {trades.map((tr) => (
                <Field key={tr.key} label={tr.name}>
                  <OptionSelect
                    className="h-9"
                    value={who[tr.key] ?? AUTO}
                    onChange={(v) => setWho((p) => ({ ...p, [tr.key]: v ?? "" }))}
                    options={[{ value: AUTO, label: t.flow.auto }, ...(contractorsByTrade[tr.key] ?? [])]}
                    noneLabel={t.tasks.noContractor}
                  />
                </Field>
              ))}
            </div>
          </details>
          <DialogFooter>
            <Button
              disabled={pending || picked.size === 0 || !start}
              onClick={async () => {
                const contractorByTrade = Object.fromEntries(Object.entries(who).filter(([, v]) => v !== AUTO).map(([k, v]) => [k, v || null]));
                const r = await call(
                  () => applyFlowAction({ kind, areaIds: [...picked], startDate: start, staggerDays: Number(stagger) || 0, contractorByTrade }),
                  (x) => t.flow.applied(x.created, x.linked),
                );
                if (r) setOpen(false);
              }}
            >
              {kind === "building" ? t.flow.applyBuilding : t.flow.apply} ({picked.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
