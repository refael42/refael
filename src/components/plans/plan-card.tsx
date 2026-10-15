import { FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PlanFile } from "@/lib/db/types";
import { fmtDate, t } from "@/lib/i18n";

export function PlanCard({ plan: p, floor, pins }: { plan: PlanFile; floor: string | null; pins: number }) {
  return (
    <Link href={`/plans/${p.id}`} className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent">
      <FileText className="h-8 w-8 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-medium">{p.title}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {p.sheet && <span dir="ltr">{p.sheet}</span>}
          {p.revision && <span>{`${t.plans.revision} ${p.revision}`}</span>}
          {(p.version ?? 1) > 1 && <Badge variant="outline">{t.plans.version(p.version)}</Badge>}
          {floor && <span>{floor}</span>}
          <span className="num">{fmtDate(p.created_at)}</span>
        </span>
      </div>
      {pins > 0 && (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {pins}
        </span>
      )}
    </Link>
  );
}
