import { ChevronLeft, Flame, Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import type { TaskCardVM } from "@/lib/services/views";
import { cn } from "@/lib/utils";
import { StateBadge } from "./state-badge";

export function TaskRow({
  task,
  unlocks,
  showReason = true,
  className,
}: {
  task: TaskCardVM;
  unlocks?: number;
  showReason?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/60", className)}
    >
      <span className="mt-1 h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.tradeColor }} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{task.title}</span>
          <StateBadge state={task.state} className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{task.area}</span>
          {task.contractor && <span>· {task.contractor}</span>}
          {task.critical && (
            <Badge variant="critical" className="px-1.5 py-0">
              <Flame className="h-3 w-3" />
              {t.tasks.critical}
            </Badge>
          )}
          {task.overdue && <Badge variant="blocked" className="px-1.5 py-0">{t.tasks.overdue}</Badge>}
          {task.blocksTransitive > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Lock className="h-3 w-3" />
              {task.blocksTransitive}
            </span>
          )}
          {unlocks !== undefined && unlocks > 0 && (
            <span className="inline-flex items-center gap-0.5 font-medium text-state-ready">
              <Unlock className="h-3 w-3" />
              {t.home.unlocks(unlocks)}
            </span>
          )}
        </div>
        {showReason && task.reason && <p className="text-xs text-state-blocked">{task.reason}</p>}
      </div>
      <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
