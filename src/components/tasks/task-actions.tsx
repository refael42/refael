"use client";
import { Ban, CheckCircle2, Play, RotateCcw, Trash2, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteTaskAction, setTaskStatusAction } from "@/app/actions/tasks";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { TaskStatus } from "@/lib/db/types";
import { t } from "@/lib/i18n";

export function TaskActions({
  taskId,
  status,
  role,
  isOwnTask,
  reportSlot,
}: {
  taskId: string;
  status: TaskStatus;
  role: "pm" | "contractor" | "viewer";
  isOwnTask: boolean;
  /** "Done + photo" button (completion report) rendered by the parent */
  reportSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const { call, pending } = useAction();
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");

  const set = (s: TaskStatus, r?: string) =>
    call(() => setTaskStatusAction(taskId, s, r), (n) => (s === "done" ? t.completion.releasedN(n) : t.app.saved));

  if (role === "viewer") return null;
  const open = status !== "done";

  if (role === "contractor") {
    if (!isOwnTask) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {(status === "planned" || status === "ready") && (
          <Button variant="outline" disabled={pending} onClick={() => set("in_progress")}>
            <Play />
            {t.my.startTask}
          </Button>
        )}
        {(status === "in_progress" || status === "ready" || status === "planned") && reportSlot}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "planned" || status === "ready") && (
        <Button variant="outline" disabled={pending} onClick={() => set("in_progress")}>
          <Play />
          {t.tasks.start}
        </Button>
      )}
      {open && status !== "blocked_manual" && (
        <Button variant="success" disabled={pending} onClick={() => set("done")}>
          <CheckCircle2 />
          {t.tasks.markDone}
        </Button>
      )}
      {status === "done" && (
        <Button variant="outline" disabled={pending} onClick={() => set("in_progress")}>
          <RotateCcw />
          {t.status.in_progress}
        </Button>
      )}
      {open && status !== "blocked_manual" && (
        <Button variant="outline" disabled={pending} onClick={() => setBlockOpen(true)}>
          <Ban />
          {t.tasks.blockManually}
        </Button>
      )}
      {status === "blocked_manual" && (
        <Button variant="outline" disabled={pending} onClick={() => set("planned")}>
          <Unlock />
          {t.tasks.unblock}
        </Button>
      )}
      {reportSlot}
      <Button
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={async () => {
          if (!confirm(t.tasks.deleteConfirm)) return;
          const ok = await call(() => deleteTaskAction(taskId));
          if (ok !== null) router.push("/tasks");
        }}
      >
        <Trash2 />
        {t.app.delete}
      </Button>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.tasks.blockManually}</DialogTitle>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.tasks.blockReason} />
          <DialogFooter>
            <Button
              disabled={pending || !reason.trim()}
              onClick={async () => {
                await set("blocked_manual", reason);
                setBlockOpen(false);
                setReason("");
              }}
            >
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
