import { redirect } from "next/navigation";
import { GraphView } from "@/components/graph/graph-view";
import type { GraphPayload } from "@/components/graph/types";
import { getStore } from "@/lib/db";
import { t } from "@/lib/i18n";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";
import { describeBlocking, formOptions, taskCard } from "@/lib/services/views";

export const metadata = { title: t.graph.title };

export default async function GraphPage({ searchParams }: { searchParams: { critical?: string; task?: string; area?: string } }) {
  const s = await requireProjectSession();
  if (s.role === "contractor") redirect("/my");
  const snap = await loadSnapshot(getStore(), s.project.id);
  const opts = formOptions(snap);

  const payload: GraphPayload = {
    nodes: [
      ...snap.tasks.map((task) => {
        const c = taskCard(snap, task.id);
        const a = snap.analysis.byTask[task.id];
        return {
          id: task.id,
          kind: "task" as const,
          title: task.title,
          state: c.state,
          critical: c.critical,
          area: c.area,
          areaId: task.area_id,
          tradeId: task.trade_id,
          tradeColor: c.tradeColor,
          contractor: c.contractor,
          contractorId: task.contractor_id,
          blocksTransitive: a.blocksTransitive,
          reasons: (a.rootBlockers.length ? a.rootBlockers : a.blockedBy).map((b) => {
            const l = describeBlocking(snap, b);
            return { text: l.text, who: l.who };
          }),
        };
      }),
      ...snap.blockers
        .filter((b) => b.status === "open")
        .map((b) => ({
          id: b.id,
          kind: "blocker" as const,
          title: b.title,
          state: "external" as const,
          critical: false,
          area: b.owner_name ?? "",
          areaId: null,
          tradeId: null,
          tradeColor: "#dc2626",
          contractor: b.owner_name,
          contractorId: null,
          blocksTransitive: snap.analysis.bottlenecks.find((x) => x.id === b.id)?.blocksTransitive ?? 0,
          reasons: [],
        })),
    ],
    edges: snap.dependencies
      .filter((d) => d.from_task_id || snap.blockerById.get(d.from_blocker_id!)?.status === "open")
      .map((d) => {
        const from = (d.from_task_id ?? d.from_blocker_id)!;
        return {
          id: d.id,
          source: from,
          target: d.to_task_id,
          lag: Number(d.lag_hours),
          critical: !!d.from_task_id && !!snap.analysis.byTask[from]?.onCriticalPath && !!snap.analysis.byTask[d.to_task_id]?.onCriticalPath,
        };
      }),
    areas: snap.areas.map((a) => ({ id: a.id, parentId: a.parent_id, label: areaLabel(snap.areaById, a.id) })),
    trades: opts.trades,
    contractors: opts.contractors.map(({ value, label }) => ({ value, label })),
  };

  return (
    <GraphView
      data={payload}
      initialCritical={searchParams.critical === "1"}
      initialTask={searchParams.task ?? null}
      initialArea={searchParams.area ?? null}
    />
  );
}
