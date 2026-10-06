/**
 * Master construction process → tasks. Applying the process to apartments
 * creates one task per stage per apartment, chained exactly as the process
 * says (with waiting times), dated from a start date. Re-applying only adds
 * missing stages and links them to the existing ones.
 */
import type { Store } from "../db/store";
import type { Task } from "../db/types";
import type { EffectiveState } from "../engine/types";
import { APARTMENT_FLOW, FLOW_TRADES, stageLevels, stageSchedule, type FlowStage } from "../flow/process";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { messageContractor } from "./messaging";
import { notify } from "./notify";
import type { ProjectSnapshot } from "./snapshot";
import { createTasks, insertDependency, ServiceError, type Ctx } from "./tasks";

/** Make sure every trade the process uses exists; returns key → id. */
export async function ensureFlowTrades(store: Store): Promise<Map<string, string>> {
  const trades = await store.select("trades");
  const have = new Set(trades.map((t) => t.key));
  const needed = new Set(APARTMENT_FLOW.map((s) => s.trade));
  const missing = FLOW_TRADES.filter((t) => needed.has(t.key) && !have.has(t.key));
  if (missing.length) {
    const max = trades.reduce((m, t) => Math.max(m, t.sort_order), 0);
    await store.insert("trades", missing.map((t, i) => ({ key: t.key, name: t.name, color: t.color, sort_order: max + i + 1 })));
  }
  return new Map((await store.select("trades")).map((t) => [t.key, t.id]));
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface ApplyFlowResult {
  created: number;
  linked: number;
  areas: number;
}

export async function applyFlow(
  ctx: Ctx,
  input: {
    areaIds: string[];
    startDate: string;
    /** optional subset of stage keys (default: all) */
    stageKeys?: string[];
    /** trade key → contractor id (default: the only contractor of that trade, if exactly one) */
    contractorByTrade?: Record<string, string | null>;
    /** stagger each apartment's start by N days (crews move from apartment to apartment) */
    staggerDays?: number;
  },
): Promise<ApplyFlowResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!input.areaIds.length || input.areaIds.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new ServiceError(he.errors.invalid);
  const tradeIds = await ensureFlowTrades(store);
  const [areas, contractors, existing] = await Promise.all([
    store.select("areas", { where: { project_id: s.project.id, id: { in: input.areaIds } } }),
    store.select("contractors", { where: { organization_id: s.project.organization_id } }),
    store.select("tasks", { where: { project_id: s.project.id, area_id: { in: input.areaIds } } }),
  ]);
  const wanted = new Set(input.stageKeys?.length ? input.stageKeys : APARTMENT_FLOW.map((x) => x.key));
  // a stage's prerequisites are always included, so the chain stays complete
  for (let changed = true; changed; ) {
    changed = false;
    for (const st of APARTMENT_FLOW)
      if (wanted.has(st.key))
        for (const a of st.after)
          if (!wanted.has(a.key)) {
            wanted.add(a.key);
            changed = true;
          }
  }
  const stages = APARTMENT_FLOW.filter((x) => wanted.has(x.key));
  const levels = stageLevels();
  stages.sort((a, b) => levels.get(a.key)! - levels.get(b.key)!);
  const schedule = stageSchedule();

  const contractorFor = (trade: string): string | null => {
    if (input.contractorByTrade && trade in input.contractorByTrade) return input.contractorByTrade[trade] ?? null;
    const tid = tradeIds.get(trade);
    const list = contractors.filter((c) => c.trade_id === tid);
    return list.length === 1 ? list[0].id : null;
  };

  const result: ApplyFlowResult = { created: 0, linked: 0, areas: 0 };
  const perContractor = new Map<string, number>();
  const ordered = [...areas].sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));

  for (const [i, area] of ordered.entries()) {
    const start = addDays(input.startDate, (input.staggerDays ?? 0) * i);
    const byStage = new Map<string, Task>();
    for (const t of existing) if (t.area_id === area.id && t.flow_stage) byStage.set(t.flow_stage, t);
    const toCreate = stages.filter((st) => !byStage.has(st.key));
    if (toCreate.length) {
      const res = await createTasks(
        ctx,
        toCreate.map((st) => {
          const when = schedule.get(st.key)!;
          return {
            title: `${st.name} – ${area.name}`,
            description: st.description,
            area_id: area.id,
            trade_id: tradeIds.get(st.trade) ?? null,
            contractor_id: contractorFor(st.trade),
            planned_start: addDays(start, when.start),
            planned_end: addDays(start, when.end - 1),
            flow_stage: st.key,
          };
        }),
        { source: "manual", quiet: true },
      );
      res.tasks.forEach((t, k) => {
        byStage.set(toCreate[k].key, t);
        if (t.contractor_id) perContractor.set(t.contractor_id, (perContractor.get(t.contractor_id) ?? 0) + 1);
      });
      result.created += res.tasks.length;
      result.areas++;
    }
    // dependencies exactly as the process says (skip ones that already exist)
    const deps = await store.select("dependencies", {
      where: { project_id: s.project.id, to_task_id: { in: [...byStage.values()].map((t) => t.id) } },
    });
    for (const st of stages) {
      const to = byStage.get(st.key)!;
      for (const a of st.after) {
        const from = byStage.get(a.key);
        if (!from || deps.some((d) => d.from_task_id === from.id && d.to_task_id === to.id)) continue;
        try {
          await insertDependency(ctx, { fromTaskId: from.id, toTaskId: to.id, lagHours: a.lag ?? 0, source: "template" });
          result.linked++;
        } catch (e) {
          if (!(e instanceof ServiceError)) throw e;
        }
      }
    }
  }

  // one summary message per contractor instead of one per task
  for (const [contractorId, n] of perContractor) {
    const sent = await messageContractor(store, s.project.id, contractorId, he.flow.assignedSummary(n, ordered.map((a) => a.name)), {});
    if (sent)
      await notify(store, [{ profileId: sent.profileId, projectId: s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: he.flow.assignedSummary(n, []), link: "/my" }]);
  }
  return result;
}

export interface StageStatus {
  key: string;
  taskId: string | null;
  state: EffectiveState | "missing";
  contractor: string | null;
}

/** Live status of every process stage in one area (apartment). */
export function flowStatus(snap: ProjectSnapshot, areaId: string): Record<string, StageStatus> {
  const out: Record<string, StageStatus> = {};
  for (const st of APARTMENT_FLOW) out[st.key] = { key: st.key, taskId: null, state: "missing", contractor: null };
  for (const t of snap.tasks) {
    if (t.area_id !== areaId || !t.flow_stage || !out[t.flow_stage]) continue;
    out[t.flow_stage] = {
      key: t.flow_stage,
      taskId: t.id,
      state: snap.analysis.byTask[t.id].effective,
      contractor: t.contractor_id ? snap.contractorById.get(t.contractor_id)?.name ?? null : null,
    };
  }
  return out;
}

export type { FlowStage };
