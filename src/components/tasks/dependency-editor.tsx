"use client";
import { Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import { addDependencyAction, removeDependencyAction } from "@/app/actions/tasks";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { TaskPicker, type PickItem } from "./task-picker";

export function RemoveDependencyButton({ depId }: { depId: string }) {
  const { call, pending } = useAction();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground"
      disabled={pending}
      aria-label={t.tasks.removeDep}
      title={t.tasks.removeDep}
      onClick={() => call(() => removeDependencyAction(depId), (n) => (n ? t.completion.releasedN(n) : t.app.saved))}
    >
      <X />
    </Button>
  );
}

/** Add a predecessor task or link an external blocker to this task. */
export function AddDependencyDialog({ taskId, tasks, blockers }: { taskId: string; tasks: PickItem[]; blockers: PickItem[] }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [lag, setLag] = useState("");
  const [tab, setTab] = useState("task");
  const { call, pending } = useAction();

  async function save() {
    const ok = await call(
      () =>
        addDependencyAction(
          tab === "task" ? { fromTaskId: from, toTaskId: taskId, lagHours: Number(lag) || 0 } : { fromBlockerId: blocker, toTaskId: taskId },
        ),
      t.app.saved,
    );
    if (ok !== null) {
      setOpen(false);
      setFrom(null);
      setBlocker(null);
      setLag("");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t.tasks.addPredecessor}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.tasks.addPredecessor}</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="task">{t.tasks.predecessors}</TabsTrigger>
              <TabsTrigger value="blocker">
                <Link2 className="h-3.5 w-3.5" />
                {t.tasks.addBlockerDep}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="task" className="flex flex-col gap-3">
              <TaskPicker items={tasks} value={from} onChange={setFrom} />
              <Field label={t.tasks.lagHours} htmlFor="lag">
                <Input id="lag" type="number" min={0} inputMode="numeric" value={lag} onChange={(e) => setLag(e.target.value)} />
              </Field>
            </TabsContent>
            <TabsContent value="blocker">
              <TaskPicker items={blockers} value={blocker} onChange={setBlocker} />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button disabled={pending || (tab === "task" ? !from : !blocker)} onClick={save}>
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
