import { Ban, CheckCircle2, CircleDot, Hourglass, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EffectiveState } from "@/lib/engine/types";
import { t } from "@/lib/i18n";

const ICON = {
  ready: CircleDot,
  blocked: Ban,
  in_progress: PlayCircle,
  awaiting_approval: Hourglass,
  done: CheckCircle2,
} as const;

export function StateBadge({ state, className }: { state: EffectiveState; className?: string }) {
  const Icon = ICON[state];
  return (
    <Badge variant={state} className={className}>
      <Icon className="h-3 w-3" />
      {t.effective[state]}
    </Badge>
  );
}

/** Background/border colour classes per state — graph nodes, gantt bars, dots. */
export const STATE_COLOR: Record<EffectiveState, string> = {
  ready: "bg-state-ready",
  blocked: "bg-state-blocked",
  in_progress: "bg-state-progress",
  awaiting_approval: "bg-state-approval",
  done: "bg-state-done",
};

export const STATE_HEX: Record<EffectiveState, string> = {
  ready: "#16a34a",
  blocked: "#dc2626",
  in_progress: "#2563eb",
  awaiting_approval: "#f59e0b",
  done: "#94a3b8",
};
