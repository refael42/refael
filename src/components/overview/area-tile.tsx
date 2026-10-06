import Link from "next/link";
import { Progress } from "@/components/ui/misc";
import { t } from "@/lib/i18n";
import type { AreaProgressVM } from "@/lib/services/views";
import { cn } from "@/lib/utils";
import { STATE_COLOR } from "@/components/tasks/state-badge";

export function AreaTile({ area, compact = false }: { area: AreaProgressVM; compact?: boolean }) {
  const pct = area.total ? Math.round((area.done / area.total) * 100) : 0;
  return (
    <Link href={`/areas/${area.id}`} className="flex flex-col gap-1.5 rounded-lg border p-3 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          {area.worst && <span className={cn("h-2.5 w-2.5 rounded-full", STATE_COLOR[area.worst])} />}
          {area.name}
        </span>
        <span className="num text-xs text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} />
      {!compact && (
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span className="text-state-ready">{`${t.home.stats.ready} ${area.ready}`}</span>
          <span className="text-state-blocked">{`${t.home.stats.blocked} ${area.blocked}`}</span>
          <span className="text-state-progress">{`${t.home.stats.inProgress} ${area.inProgress}`}</span>
        </div>
      )}
    </Link>
  );
}
