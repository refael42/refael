import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplyFlowDialog } from "@/components/flow/apply-flow-dialog";
import { FlowAreaSelect } from "@/components/flow/area-select";
import { AssignDialog, type TradeRow } from "@/components/flow/assign-dialog";
import { CaptureDialog } from "@/components/flow/capture-dialog";
import { FeaturesDialog } from "@/components/flow/features-dialog";
import { FlowBoard, type BoardRow } from "@/components/flow/flow-board";
import { FlowEditor } from "@/components/flow/flow-editor";
import { FlowViews } from "@/components/flow/flow-views";
import type { FlowStageVM } from "@/components/flow/types";
import type { AreaGroup } from "@/components/tasks/bulk-task-dialog";
import { getStore } from "@/lib/db";
import { FEATURES, FLOW_TRADES, opensOf, PARTS, PHASES, stageLevels, stageSchedule, type FlowKind } from "@/lib/flow/process";
import { localDate, t } from "@/lib/i18n";
import { isPM, isStaff } from "@/lib/services/access";
import { flowStatus, placeAreaIds } from "@/lib/services/flow";
import { loadFlow } from "@/lib/services/flow-template";
import { requireProjectSession } from "@/lib/services/session";
import { areaLabel, loadSnapshot } from "@/lib/services/snapshot";
import { cn } from "@/lib/utils";

export const metadata = { title: t.flow.title };

export default async function FlowPage({ searchParams }: { searchParams: { area?: string; tab?: string; kind?: string } }) {
  const s = await requireProjectSession();
  if (!isStaff(s)) redirect("/my");
  const kind: FlowKind = searchParams.kind === "building" ? "building" : "apartment";
  const store = getStore();
  const [snap, { stages: FLOW, custom }, other] = await Promise.all([
    loadSnapshot(store, s.project.id),
    loadFlow(store, s.project.organization_id, kind),
    loadFlow(store, s.project.organization_id, kind === "apartment" ? "building" : "apartment"),
  ]);
  const levels = stageLevels(FLOW);
  const sched = stageSchedule(FLOW);
  const tradeName = (key: string) => snap.trades.find((x) => x.key === key)?.name ?? FLOW_TRADES.find((x) => x.key === key)?.name ?? key;
  const byNum = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he", { numeric: true });
  const apartments = snap.areas.filter((a) => a.type === "apartment").sort(byNum);
  const buildings = snap.areas.filter((a) => a.type === "building").sort(byNum);
  const places = kind === "building" ? buildings : apartments;
  const area = searchParams.area ? snap.areaById.get(searchParams.area) : undefined;
  const live = area && places.some((p) => p.id === area.id) ? flowStatus(snap, area.id, FLOW) : null;
  const buildingNames = new Map((kind === "apartment" ? other.stages : FLOW).map((x) => [x.key, x.name]));

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
    after: st.after.map((a) => ({
      key: a.key,
      name: a.scope ? buildingNames.get(a.key) ?? a.key : FLOW.find((x) => x.key === a.key)?.name ?? a.key,
      lag: a.lag ?? 0,
      why: a.why ?? null,
      building: a.scope === "building",
    })),
    opens: opensOf(st.key, FLOW).map((o) => ({ key: o.key, name: o.name })),
    live: live ? { state: live[st.key].state, taskId: live[st.key].taskId, contractor: live[st.key].contractor } : null,
    when: st.when ? FEATURES[st.when]?.only ?? st.when : null,
    part: st.part ? PARTS[st.part]?.name ?? st.part : null,
  }));
  const totalDays = Math.max(0, ...[...sched.values()].map((v) => v.end));

  const floors = snap.areas.filter((a) => a.type === "floor").sort(byNum);
  const groups: AreaGroup[] =
    kind === "building"
      ? [{ id: "__buildings__", label: t.flow.kindBuilding, children: buildings.map((b) => ({ id: b.id, label: b.name })) }].filter((g) => g.children.length)
      : [
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

  // places × stages board (only places the process was applied to)
  const ordered = [...stages].sort((a, b) => a.level - b.level || a.start - b.start);
  const featureLabel = (features: string[] | undefined) =>
    (features ?? []).filter((f) => FEATURES[f]).map((f) => FEATURES[f].name).join(", ");
  const boardRows: BoardRow[] = places
    .map((a) => {
      const st = flowStatus(snap, a.id, FLOW);
      const cells = ordered.map((x) => st[x.key]);
      const counted = cells.filter((c) => c.state !== "skip" || c.taskId);
      const extra = featureLabel(a.features);
      return {
        areaId: a.id,
        label: `${kind === "building" ? a.name : areaLabel(snap.areaById, a.id)}${extra ? ` (${extra})` : ""}`,
        cells,
        done: counted.filter((c) => c.state === "done").length,
        total: counted.length,
        current: ordered.filter((x) => ["ready", "in_progress", "awaiting_approval"].includes(st[x.key].state)).map((x) => x.name),
      };
    })
    .filter((r) => r.cells.some((c) => c.taskId));
  // trades of this process's open tasks, for "assign contractors"
  const keys = new Set(FLOW.map((x) => x.key));
  const placeAreas = new Set(places.flatMap((p) => [...placeAreaIds(snap.areas, p)]));
  const flowOpen = snap.tasks.filter((x) => x.flow_stage && keys.has(x.flow_stage) && x.area_id && placeAreas.has(x.area_id) && x.status !== "done" && x.trade_id);
  const assignRows: TradeRow[] = [...new Set(flowOpen.map((x) => x.trade_id!))]
    .map((tid) => {
      const tr = snap.tradeById.get(tid);
      const list = flowOpen.filter((x) => x.trade_id === tid);
      const sameTrade = snap.contractors.filter((c) => c.trade_id === tid);
      const others = snap.contractors.filter((c) => c.trade_id !== tid);
      return {
        tradeId: tid,
        name: tr?.name ?? "",
        open: list.length,
        unassigned: list.filter((x) => !x.contractor_id).length,
        options: [...sameTrade, ...others].map((c) => ({ value: c.id, label: c.name, hint: c.trade_id ? snap.tradeById.get(c.trade_id)?.name : undefined })),
      };
    })
    .sort((a, b) => b.unassigned - a.unassigned || a.name.localeCompare(b.name, "he"));
  const allTradeKeys = [...new Set([...FLOW_TRADES.map((x) => x.key), ...snap.trades.map((x) => x.key)])];
  const kindFeatures = Object.entries(FEATURES)
    .filter(([, v]) => v.of === kind)
    .map(([k, v]) => ({ key: k, name: v.name }));
  const kindHref = (k: FlowKind) => (k === "building" ? "/flow?kind=building" : "/flow");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold">{t.flow.title}</h1>
          <p className="text-sm text-muted-foreground">{kind === "building" ? t.flow.kindBuildingHint : t.flow.hint}</p>
          <p className="text-xs text-muted-foreground">{kind === "building" ? t.flow.totalDaysBuilding(totalDays) : t.flow.totalDays(totalDays)}</p>
        </div>
        {isPM(s) && (
          <div className="flex flex-wrap gap-2">
            <FeaturesDialog kind={kind} groups={groups} features={kindFeatures} />
            <ApplyFlowDialog
              kind={kind}
              groups={groups}
              trades={flowTradeKeys.map((k) => ({ key: k, name: tradeName(k) }))}
              contractorsByTrade={contractorsByTrade}
              defaultStart={localDate(snap.now)}
            />
          </div>
        )}
      </div>
      <nav className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto sm:self-start" aria-label={t.flow.title}>
        {(["apartment", "building"] as const).map((k) => (
          <Link
            key={k}
            href={kindHref(k)}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none",
              k === kind ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "building" ? t.flow.kindBuilding : t.flow.kindApartment}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <FlowAreaSelect
          kind={kind}
          value={live ? area!.id : null}
          options={places.map((a) => ({ value: a.id, label: kind === "building" ? a.name : areaLabel(snap.areaById, a.id) }))}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.values(PHASES)
            .filter((p) => FLOW.some((x) => PHASES[x.phase] === p))
            .map((p) => (
              <span key={p.name} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            ))}
        </div>
      </div>
      <FlowViews
        key={kind}
        tab={searchParams.tab}
        stages={stages}
        boardLabel={kind === "building" ? t.flow.tabBoardBuilding : t.flow.tabBoard}
        board={
          <FlowBoard
            stages={ordered.map((x) => ({ key: x.key, name: x.part ? `${x.part} · ${x.name}` : x.name, color: x.phaseColor }))}
            rows={boardRows}
            hint={kind === "building" ? t.flow.boardHintBuilding : undefined}
            editable={isPM(s)}
            actions={
              isPM(s) ? (
                <>
                  <CaptureDialog kind={kind} groups={groups} stages={ordered.map((x) => ({ key: x.key, name: x.name, step: x.level }))} today={localDate(snap.now)} />
                  {assignRows.length > 0 && <AssignDialog trades={assignRows} groups={groups} />}
                </>
              ) : undefined
            }
          />
        }
        editor={
          isPM(s) ? (
            <FlowEditor
              key={`${kind}-${custom}-${FLOW.map((x) => x.key).join()}`}
              kind={kind}
              initial={FLOW}
              custom={custom}
              trades={allTradeKeys.map((k) => ({ value: k, label: tradeName(k) }))}
              cross={kind === "apartment" ? other.stages.map((x) => ({ key: x.key, name: x.name })) : []}
            />
          ) : undefined
        }
      />
    </div>
  );
}
