"use client";
import { UserRoundCog } from "lucide-react";
import { useState } from "react";
import { assignByTradeAction } from "@/app/actions/flow";
import { OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { AreaPicker } from "./area-picker";

const KEEP = "__keep__";

export interface TradeRow {
  tradeId: string;
  name: string;
  open: number;
  unassigned: number;
  options: Option[];
}

/** Assign a contractor per trade to the process tasks, across apartments. */
export function AssignDialog({ trades, groups }: { trades: TradeRow[]; groups: AreaGroup[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { call, pending } = useAction();
  const changes = Object.entries(who).filter(([, v]) => v !== KEEP);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserRoundCog />
        {t.setup.assign}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.setup.assignTitle}</DialogTitle>
            <DialogDescription>{t.setup.assignHint}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>
              {t.setup.allApartments}
            </Button>
            <Button size="sm" variant={scope === "some" ? "default" : "outline"} onClick={() => setScope("some")}>
              {t.setup.someApartments}
            </Button>
          </div>
          {scope === "some" && <AreaPicker groups={groups} picked={picked} onChange={setPicked} />}
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {trades.map((tr) => (
              <div key={tr.tradeId} className="grid grid-cols-[1fr_11rem] items-center gap-2 text-sm">
                <span>
                  <span className="font-medium">{tr.name}</span>
                  {tr.unassigned > 0 && <span className="ms-2 text-xs text-state-blocked">{t.setup.unassigned(tr.unassigned)}</span>}
                </span>
                <OptionSelect
                  className="h-9"
                  value={who[tr.tradeId] ?? KEEP}
                  onChange={(v) => setWho((p) => ({ ...p, [tr.tradeId]: v ?? "" }))}
                  options={[{ value: KEEP, label: t.setup.keep }, ...tr.options]}
                  noneLabel={t.tasks.noContractor}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !changes.length || (scope === "some" && !picked.size)}
              onClick={async () => {
                const r = await call(
                  () => assignByTradeAction({ areaIds: scope === "all" ? null : [...picked], byTrade: Object.fromEntries(changes.map(([k, v]) => [k, v || null])) }),
                  (x) => t.setup.assigned(x.updated),
                );
                if (r) {
                  setOpen(false);
                  setWho({});
                }
              }}
            >
              {t.setup.assignButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
