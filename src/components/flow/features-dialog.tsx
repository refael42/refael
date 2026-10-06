"use client";
import { Tags } from "lucide-react";
import { useState } from "react";
import { setFeaturesAction } from "@/app/actions/flow";
import { useAction } from "@/components/common/use-action";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FlowKind } from "@/lib/flow/process";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AreaPicker } from "./area-picker";

type Choice = "keep" | "on" | "off";

/** Mark garden apartments / duplexes, or what a building has (parking, elevator, sprinklers). */
export function FeaturesDialog({ kind, groups, features }: { kind: FlowKind; groups: AreaGroup[]; features: Array<{ key: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const { call, pending } = useAction();
  const add = features.filter((f) => choice[f.key] === "on").map((f) => f.key);
  const remove = features.filter((f) => choice[f.key] === "off").map((f) => f.key);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Tags />
        {kind === "building" ? t.flow.featuresTitleBuilding : t.flow.featuresTitleApt}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{kind === "building" ? t.flow.featuresTitleBuilding : t.flow.featuresTitleApt}</DialogTitle>
            <DialogDescription>{kind === "building" ? t.flow.featuresHintBuilding : t.flow.featuresHintApt}</DialogDescription>
          </DialogHeader>
          <AreaPicker groups={groups} picked={picked} onChange={setPicked} />
          <div className="flex flex-col gap-2">
            {features.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{f.name}</span>
                <div className="flex overflow-hidden rounded-md border">
                  {(["keep", "on", "off"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChoice((p) => ({ ...p, [f.key]: c }))}
                      className={cn(
                        "px-3 py-1 text-xs",
                        (choice[f.key] ?? "keep") === c ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                      )}
                    >
                      {c === "keep" ? t.setup.keep : c === "on" ? t.flow.featureOn : t.flow.featureOff}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !picked.size || (!add.length && !remove.length)}
              onClick={async () => {
                const r = await call(() => setFeaturesAction({ areaIds: [...picked], add, remove }), (x) => t.flow.featuresSaved(x.updated, x.created));
                if (r) {
                  setOpen(false);
                  setChoice({});
                }
              }}
            >
              {t.app.save} ({picked.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
