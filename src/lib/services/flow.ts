/**
 * Master construction process → tasks. Applying the process to apartments
 * creates one task per stage per apartment, chained exactly as the process
 * says (with waiting times), dated from a start date. Re-applying only adds
 * missing stages and links them to the existing ones.
 */
import type { Store } from "../db/store";
import type { Task } from "../db/types";
import type { EffectiveState } from "../engine/types";
import { FLOW_TRADES, stageLevels, stageSchedule, type FlowStage } from "../flow/process";
import { loadFlow } from "./flow-template";
import { he } from "../i18n/he";
import { assertPM } from "./access";
import { messageContractor } from "./messaging";
import { audit } from "./audit";
import { notify } from "./notify";
import { withRelease } from "./release";
import type { ProjectSnapshot } from "./snapshot";
import { createTasks, insertDependency, ServiceError, type Ctx } from "./tasks";

/** Make sure every trade the process uses exists; returns key → id. */
export async function ensureFlowTrades(store: Store, flow: FlowStage[]): Promise<Map<string, string>> {
  const trades = await store.select("trades");
  const have = new Set(trades.map((t) => t.key));
  const needed = new Set(flow.map((s) => s.trade));
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
    /** don't message contractors about the new tasks */
    quiet?: boolean;
  },
): Promise<ApplyFlowResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!input.areaIds.length || input.areaIds.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new ServiceError(he.errors.invalid);
  const { stages: FLOW } = await loadFlow(store, s.project.organization_id);
  const tradeIds = await ensureFlowTrades(store, FLOW);
  const [areas, orgContractors, members, existing] = await Promise.all([
    store.select("areas", { where: { project_id: s.project.id, id: { in: input.areaIds } } }),
    store.select("contractors", { where: { organization_id: s.project.organization_id } }),
    store.select("project_members", { where: { project_id: s.project.id } }),
    store.select("tasks", { where: { project_id: s.project.id, area_id: { in: input.areaIds } } }),
  ]);
  const wanted = new Set(input.stageKeys?.length ? input.stageKeys : FLOW.map((x) => x.key));
  // a stage's prerequisites are always included, so the chain stays complete
  for (let changed = true; changed; ) {
    changed = false;
    for (const st of FLOW)
      if (wanted.has(st.key))
        for (const a of st.after)
          if (!wanted.has(a.key)) {
            wanted.add(a.key);
            changed = true;
          }
  }
  const stages = FLOW.filter((x) => wanted.has(x.key));
  const levels = stageLevels(FLOW);
  stages.sort((a, b) => levels.get(a.key)! - levels.get(b.key)!);
  const schedule = stageSchedule(FLOW);

  // auto-assign only contractors who are on this project (they must be able to see their tasks)
  const memberIds = new Set(members.map((m) => m.profile_id));
  const contractors = orgContractors.filter((c) => c.profile_id && memberIds.has(c.profile_id));
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
  for (const [contractorId, n] of input.quiet ? [] : perContractor) {
    const sent = await messageContractor(store, s.project.id, contractorId, he.flow.assignedSummary(n, ordered.map((a) => a.name)), {});
    if (sent)
      await notify(store, [{ profileId: sent.profileId, projectId: s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: he.flow.assignedSummary(n, []), link: "/my" }]);
  }
  return result;
}

function ancestorsOf(flow: FlowStage[], key: string): Set<string> {
  const byKey = new Map(flow.map((s) => [s.key, s]));
  const out = new Set<string>();
  const stack = [key];
  while (stack.length) {
    const k = stack.pop()!;
    if (out.has(k) || !byKey.has(k)) continue;
    out.add(k);
    stack.push(...byKey.get(k)!.after.map((a) => a.key));
  }
  return out;
}

const CAPTURED_AGE_MS = 8 * 86_400_000;

export interface CaptureResult {
  created: number;
  marked: number;
  rescheduled: number;
}

/**
 * Capture a site that is already under way: for each apartment, the chosen
 * stage and everything it requires are marked done — quietly (no reports, no
 * messages). Stages left are optionally re-dated to start from `rescheduleFrom`.
 * The process is applied first where it wasn't yet.
 */
export async function captureExisting(
  ctx: Ctx,
  input: { areaIds: string[]; doneUpTo: string | null; rescheduleFrom?: string | null },
): Promise<CaptureResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!input.areaIds.length || input.areaIds.length > 200) throw new ServiceError(he.errors.invalid);
  if (input.rescheduleFrom && !/^\d{4}-\d{2}-\d{2}$/.test(input.rescheduleFrom)) throw new ServiceError(he.errors.invalid);
  const { stages: FLOW } = await loadFlow(store, s.project.organization_id);
  if (input.doneUpTo && !FLOW.some((x) => x.key === input.doneUpTo)) throw new ServiceError(he.errors.invalid);
  const now = (ctx.now ?? new Date()).toISOString();
  // work that was already done on site: backdated, so drying waits are over and it isn't "completed this week"
  const doneAt = new Date(Date.parse(now) - CAPTURED_AGE_MS).toISOString();
  const res: CaptureResult = { created: 0, marked: 0, rescheduled: 0 };

  // make sure every apartment has the process
  for (let i = 0; i < input.areaIds.length; i += 60) {
    const r = await applyFlow(ctx, { areaIds: input.areaIds.slice(i, i + 60), startDate: input.rescheduleFrom ?? now.slice(0, 10), quiet: true });
    res.created += r.created;
  }
  const done = input.doneUpTo ? ancestorsOf(FLOW, input.doneUpTo) : new Set<string>();
  const tasks = await store.select("tasks", { where: { project_id: s.project.id, area_id: { in: input.areaIds } } });
  const flowTasks = tasks.filter((t) => t.flow_stage);

  await withRelease(store, s.project.id, { actor: s.profile.id, source: "manual", now: ctx.now, quiet: true }, async () => {
    const toMark = flowTasks.filter((t) => done.has(t.flow_stage!) && t.status !== "done");
    if (toMark.length) {
      const ids = toMark.map((t) => t.id);
      await store.update("tasks", { id: { in: ids } }, { status: "done", completed_at: doneAt, blocked_reason: null });
      await store.update("reminders", { task_id: { in: ids }, status: { in: ["pending", "sent"] } }, { status: "resolved" });
      for (const t of toMark)
        await audit(store, { projectId: s.project.id, entityType: "task", entityId: t.id, action: "status", from: t.status, to: "done", actor: s.profile.id, source: "manual", meta: { reason: "captured_existing" } });
      res.marked = toMark.length;
    }
    if (input.rescheduleFrom) {
      // per apartment: shift the open stages so the earliest starts on the given date
      for (const areaId of input.areaIds) {
        const open = flowTasks.filter((t) => t.area_id === areaId && !done.has(t.flow_stage!) && t.status !== "done" && t.planned_start);
        if (!open.length) continue;
        const min = open.reduce((m, t) => (t.planned_start! < m ? t.planned_start! : m), open[0].planned_start!);
        const shift = Math.round((Date.parse(input.rescheduleFrom) - Date.parse(min)) / 86_400_000);
        if (!shift) continue;
        for (const t of open) {
          await store.update("tasks", { id: t.id }, { planned_start: addDays(t.planned_start!, shift), planned_end: t.planned_end ? addDays(t.planned_end, shift) : null });
          res.rescheduled++;
        }
      }
    }
    return {};
  });
  return res;
}

/** Quietly flip one stage done ↔ not done while capturing a site. */
export async function toggleCaptured(ctx: Ctx, taskId: string) {
  assertPM(ctx.s);
  const { store, s } = ctx;
  const task = await store.byId("tasks", taskId);
  if (!task || task.project_id !== s.project.id) throw new ServiceError(he.errors.notFound);
  const to = task.status === "done" ? "planned" : "done";
  const now = new Date((ctx.now ?? new Date()).getTime() - CAPTURED_AGE_MS).toISOString();
  await withRelease(store, s.project.id, { actor: s.profile.id, source: "manual", now: ctx.now, quiet: true }, async () => {
    await store.update("tasks", { id: taskId }, { status: to, completed_at: to === "done" ? now : null, blocked_reason: null });
    if (to === "done") await store.update("reminders", { task_id: taskId, status: { in: ["pending", "sent"] } }, { status: "resolved" });
    await audit(store, { projectId: s.project.id, entityType: "task", entityId: taskId, action: "status", from: task.status, to, actor: s.profile.id, source: "manual", meta: { reason: "captured_existing" } });
    return {};
  });
  return to;
}

/**
 * Assign contractors to the process tasks by trade (e.g. "all plaster → Samer"),
 * in the chosen apartments. Done tasks are left as they were. One summary
 * message per contractor (none in setup mode).
 */
export async function assignByTrade(ctx: Ctx, input: { areaIds: string[] | null; byTrade: Record<string, string | null> }): Promise<{ updated: number }> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  const tradeIds = Object.keys(input.byTrade);
  if (!tradeIds.length) return { updated: 0 };
  const contractorIds = [...new Set(Object.values(input.byTrade).filter(Boolean))] as string[];
  const own = contractorIds.length ? await store.select("contractors", { where: { id: { in: contractorIds }, organization_id: s.project.organization_id } }) : [];
  if (own.length !== contractorIds.length) throw new ServiceError(he.errors.notFound);
  const tasks = await store.select("tasks", {
    where: { project_id: s.project.id, trade_id: { in: tradeIds }, ...(input.areaIds ? { area_id: { in: input.areaIds } } : {}) },
  });
  const perContractor = new Map<string, number>();
  let updated = 0;
  for (const tradeId of tradeIds) {
    const to = input.byTrade[tradeId] ?? null;
    const list = tasks.filter((t) => t.trade_id === tradeId && t.flow_stage && t.status !== "done" && t.contractor_id !== to);
    if (!list.length) continue;
    await store.update("tasks", { id: { in: list.map((t) => t.id) } }, { contractor_id: to });
    updated += list.length;
    if (to) perContractor.set(to, (perContractor.get(to) ?? 0) + list.length);
  }
  // the contractor must be on the project to see the tasks
  for (const c of own)
    if (c.profile_id && !(await store.first("project_members", { where: { project_id: s.project.id, profile_id: c.profile_id } })))
      await store.insert("project_members", { project_id: s.project.id, profile_id: c.profile_id, role: "contractor" });
  for (const [contractorId, n] of perContractor) {
    const sent = await messageContractor(store, s.project.id, contractorId, he.flow.assignedSummary(n, []), {});
    if (sent)
      await notify(store, [{ profileId: sent.profileId, projectId: s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: he.flow.assignedSummary(n, []), link: "/my" }]);
  }
  return { updated };
}

export interface StageStatus {
  key: string;
  taskId: string | null;
  state: EffectiveState | "missing";
  contractor: string | null;
}

/** Live status of every process stage in one area (apartment). */
export function flowStatus(snap: ProjectSnapshot, areaId: string, flow: FlowStage[]): Record<string, StageStatus> {
  const out: Record<string, StageStatus> = {};
  for (const st of flow) out[st.key] = { key: st.key, taskId: null, state: "missing", contractor: null };
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
