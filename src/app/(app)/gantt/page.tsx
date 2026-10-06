import { redirect } from "next/navigation";
import { GanttChart, type GanttRow } from "@/components/gantt/gantt-chart";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { requireProjectSession } from "@/lib/services/session";
import { areaPath, loadSnapshot } from "@/lib/services/snapshot";

export const metadata = { title: t.nav.gantt };

const dayOffset = (date: string | null, today: string) =>
  date ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) : null;

export default async function GanttPage() {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const today = snap.now.toISOString().slice(0, 10);
  // hours from now → day offsets from the start of today
  const hoursIntoDay = (snap.now.getTime() - Date.parse(`${today}T00:00:00Z`)) / 3600_000;
  const rows: GanttRow[] = snap.tasks
    .filter((x) => x.status !== "done")
    .map((x) => {
      const a = snap.analysis.byTask[x.id];
      const path = areaPath(snap.areaById, x.area_id);
      const group = path.find((p) => p.type === "floor") ?? path.find((p) => p.type === "common") ?? path[0];
      return {
        id: x.id,
        title: x.title,
        area: path.map((p) => p.name).join(" › "),
        areaGroup: group?.name ?? t.tasks.noArea,
        trade: snap.tradeById.get(x.trade_id ?? "")?.name ?? t.tasks.noTrade,
        state: a.effective,
        critical: a.onCriticalPath || x.is_critical,
        start: (a.earlyStart + hoursIntoDay) / 24,
        end: (a.earlyFinish + hoursIntoDay) / 24,
        plannedStart: dayOffset(x.planned_start, today),
        plannedEnd: dayOffset(x.planned_end, today),
      };
    });
  return (
    <div className="flex flex-col gap-3 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-bold">{t.gantt.title}</h1>
        <p className="text-sm text-muted-foreground">{t.gantt.hint}</p>
      </div>
      <GanttChart rows={rows} today={today} />
    </div>
  );
}
