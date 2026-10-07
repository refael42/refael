"use client";
import { Play } from "lucide-react";
import { setTaskStatusAction } from "@/app/actions/tasks";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function StartButton({ taskId }: { taskId: string }) {
  const { call, pending } = useAction();
  return (
    <Button size="lg" variant="outline" disabled={pending} onClick={() => call(() => setTaskStatusAction(taskId, "in_progress"), t.my.started)}>
      <Play />
      {t.my.startTask}
    </Button>
  );
}
