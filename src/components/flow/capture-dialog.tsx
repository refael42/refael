"use client";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { captureExistingAction } from "@/app/actions/flow";
import { Field, OptionSelect } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { t } from "@/lib/i18n";
import { AreaPicker } from "./area-picker";

const NOTHING = "__nothing__";

/** Capture apartments that are already under way: "done up to stage X". */
export function CaptureDialog({ groups, stages, today }: { groups: AreaGroup[]; stages: Array<{ key: string; name: string; step: number }>; today: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [upTo, setUpTo] = useState<string>(NOTHING);
  const [resched, setResched] = useState(true);
  const [from, setFrom] = useState(today);
  const { call, pending } = useAction();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardCheck />
        {t.setup.capture}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.setup.captureTitle}</DialogTitle>
            <DialogDescription>{t.setup.captureHint}</DialogDescription>
          </DialogHeader>
          <AreaPicker groups={groups} picked={picked} onChange={setPicked} />
          <Field label={t.setup.doneUpTo}>
            <OptionSelect
              value={upTo}
              onChange={(v) => setUpTo(v ?? NOTHING)}
              options={[{ value: NOTHING, label: t.setup.nothingDone }, ...stages.map((s) => ({ value: s.key, label: `${s.step}. ${s.name}` }))]}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={resched} onCheckedChange={(v) => setResched(!!v)} />
              {t.setup.reschedule}
            </label>
            <Input type="date" className="h-8 w-40" value={from} disabled={!resched} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={pending || picked.size === 0}
              onClick={async () => {
                const r = await call(
                  () => captureExistingAction({ areaIds: [...picked], doneUpTo: upTo === NOTHING ? null : upTo, rescheduleFrom: resched ? from : null }),
                  (x) => t.setup.captured(x.marked, x.created, x.rescheduled),
                );
                if (r) {
                  setOpen(false);
                  setPicked(new Set());
                }
              }}
            >
              {t.setup.capture} ({picked.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
