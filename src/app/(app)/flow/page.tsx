import { redirect } from "next/navigation";
import { ApplyFlowDialog } from "@/components/flow/apply-flow-dialog";
import { FlowAreaSelect } from "@/components/flow/area-select";
import { FlowBoard, type BoardRow } from "@/components/flow/flow-board";
import { FlowEditor } from "@/components/flow/flow-editor";
import { FlowViews } from "@/components/flow/flow-views";
import type { FlowStageVM } from "@/components/flow/types";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { getStore } from "@/lib/db";
import { FLOW_TRADES, opensOf, PHASES, stageLevels, stageSchedule } from "@/lib/flow/process";
import { localDate, t } from "@/lib/i18n";
import { isPM, isStaff } from "@/lib/services/access";
import { flowStatus } from "@/lib/services/flow";
import { loadFlow } from "@/lib/services/flow-template";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";

export const metadata = { title: t.flow.title };

export default async function FlowPage({ searchParams }: { searchParams: { area?: string } }) {
  const s = await requireProjectSession();
  if (!isStaff(s)) redirect("/my");
  const store = getStore();
  const [snap, { stages: FLOW, custom }] = await Promise.all([loadSnapshot(store, s.project.id), loadFlow(store, s.project.organization_id)]);
  const levels = stageLevels(FLOW);
  const sched = stageSchedule(FLOW);
  const tradeName = (key: string) => snap.trades.find((x) => x.key === key)?.name ?? FLOW_TRADES.find((x) => x.key === key)?.name ?? key;
  const area = searchParams.area ? snap.areaById.get(searchParams.area) : undefined;
  const live = area ? flowStatus(snap, area.id, FLOW) : null;

  const stages: FlowStageVM[] = FLOW.map((st) => ({
    key: st.key,
    name: st.name,
    phase: st.phase,
    phaseName: PHASES[st.phase]?.name ?? st.phase,
    phaseColor: PHASES[st.phase]?.color ?? "#64748b",
    trade: tradeName(st.trade),
    days: st.days,
    level: levels.get(st.key)!,
    start: sched.get(st.key)!.start,
    description: st.description,
    after: st.after.map((a) => ({ key: a.key, name: FLOW.find((x) => x.key === a.key)?.name ?? a.key, lag: a.lag ?? 0, why: a.why ?? null })),
    opens: opensOf(st.key, FLOW).map((o) => ({ key: o.key, name: o.name })),
    live: live ? { state: live[st.key].state, taskId: live[st.key].taskId, contractor: live[st.key].contractor } : null,
  }));
  const totalDays = Math.max(0, ...[...sched.values()].map((v) => v.end));

  const byNum = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he", { numeric: true });
  const apartments = snap.areas.filter((a) => a.type === "apartment").sort(byNum);
  const floors = snap.areas.filter((a) => a.type === "floor").sort(byNum);
  const groups: AreaGroup[] = [
    ...floors.map((f) => ({ id: f.id, label: areaLabel(snap.areaById, f.id), children: apartments.filter((a) => a.parent_id === f.id).map((a) => ({ id: a.id, label: a.name })) })),
    { id: "__all__", label: t.bulk.allApartments, children: apartments.map((a) => ({ id: a.id, label: a.name })) },
  ].filter((g) => g.children.length);
  const flowTradeKeys = [...new Set(FLOW.map((x) => x.trade))];
  const contractorsByTrade = Object.fromEntries(
    flowTradeKeys.map((k) => {
      const tid = snap.trades.find((x) => x.key === k)?.id;
      return [k, snap.contractors.filter((c) => c.trade_id === tid).map((c) => ({ value: c.id, label: c.name }))];
    }),
  );

  // apartments × stages board (only apartments the process was applied to)
  const ordered = [...stages].sort((a, b) => a.level - b.level || a.start - b.start);
  const boardRows: BoardRow[] = apartments
    .map((a) => {
      const st = flowStatus(snap, a.id, FLOW);
      const cells = ordered.map((x) => st[x.key]);
      return {
        areaId: a.id,
        label: areaLabel(snap.areaById, a.id),
        cells,
        done: cells.filter((c) => c.state === "done").length,
        total: cells.length,
        current: ordered.filter((x) => ["ready", "in_progress", "awaiting_approval"].includes(st[x.key].state)).map((x) => x.name),
      };
    })
    .filter((r) => r.cells.some((c) => c.taskId));
  const allTradeKeys = [...new Set([...FLOW_TRADES.map((x) => x.key), ...snap.trades.map((x) => x.key)])];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold">{t.flow.title}</h1>
          <p className="text-sm text-muted-foreground">{t.flow.hint}</p>
          <p className="text-xs text-muted-foreground">{t.flow.totalDays(totalDays)}</p>
        </div>
        {isPM(s) && (
          <ApplyFlowDialog
            groups={groups}
            trades={flowTradeKeys.map((k) => ({ key: k, name: tradeName(k) }))}
            contractorsByTrade={contractorsByTrade}
            defaultStart={localDate(snap.now)}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FlowAreaSelect value={area?.id ?? null} options={apartments.map((a) => ({ value: a.id, label: areaLabel(snap.areaById, a.id) }))} />
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.values(PHASES).map((p) => (
            <span key={p.name} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      </div>
      <FlowViews
        stages={stages}
        board={<FlowBoard stages={ordered.map((x) => ({ key: x.key, name: x.name, color: x.phaseColor }))} rows={boardRows} />}
        editor={isPM(s) ? <FlowEditor key={`${custom}-${FLOW.map((x) => x.key).join()}`} initial={FLOW} custom={custom} trades={allTradeKeys.map((k) => ({ value: k, label: tradeName(k) }))} /> : undefined}
      />
    </div>
  );
}
