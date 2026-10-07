/**
 * Master construction process → tasks. Applying the process to apartments
 * creates one task per stage per apartment, chained exactly as the process
 * says (with waiting times), dated from a start date. Re-applying only adds
 * missing stages and links them to the existing ones.
 */
import type { Store } from "../db/store";
import type { Area, Task } from "../db/types";
import type { EffectiveState } from "../engine/types";
import { FEATURES, FLOW_TRADES, PARTS, stageLevels, stageSchedule, stagesFor, type FlowKind, type FlowStage } from "../flow/process";
import { assertKind, loadFlow } from "./flow-template";
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

// ───────────────────────── places ─────────────────────────
// A "place" is what a process is applied to: an apartment, or a building
// (whose shared-parts tasks live in sub-areas: roof, lobby, stairwell…).

type AreaRow = Pick<Area, "id" | "parent_id" | "type" | "name" | "features">;

const feats = (a: { features?: string[] | null } | undefined) => a?.features ?? [];

export function buildingOf(areas: AreaRow[], id: string): AreaRow | null {
  const byId = new Map(areas.map((a) => [a.id, a]));
  for (let cur = byId.get(id); cur; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) if (cur.type === "building") return cur;
  return null;
}

/** Features that decide which stages apply: the apartment's own + its building's. */
export function placeFeatures(areas: AreaRow[], place: AreaRow): string[] {
  if (place.type === "building") return feats(place);
  return [...feats(place), ...feats(buildingOf(areas, place.id) ?? undefined)];
}

/** Areas whose tasks belong to this place's process. */
export function placeAreaIds(areas: AreaRow[], place: AreaRow): Set<string> {
  if (place.type !== "building") return new Set([place.id]);
  return new Set([place.id, ...areas.filter((a) => a.parent_id === place.id && a.type === "common" && feats(a).some((f) => f in PARTS)).map((a) => a.id)]);
}

export const kindOf = (place: { type: string }): FlowKind => (place.type === "building" ? "building" : "apartment");

/** The included stages for a place, optionally limited to `wanted` keys (+ their prerequisites). */
function planFor(flow: FlowStage[], features: string[], wantedKeys?: string[]) {
  const included = stagesFor(flow, features);
  const wanted = new Set(wantedKeys?.length ? wantedKeys : included.map((x) => x.key));
  for (let changed = true; changed; ) {
    changed = false;
    for (const st of included)
      if (wanted.has(st.key))
        for (const a of st.after)
          if (!a.scope && !wanted.has(a.key)) {
            wanted.add(a.key);
            changed = true;
          }
  }
  const levels = stageLevels(included);
  const stages = included.filter((x) => wanted.has(x.key)).sort((a, b) => levels.get(a.key)! - levels.get(b.key)!);
  return { stages, schedule: stageSchedule(included), included };
}

export async function applyFlow(
  ctx: Ctx,
  input: {
    /** "apartment" (default): areaIds are apartments; "building": areaIds are buildings */
    kind?: FlowKind;
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
  const kind = assertKind(input.kind ?? "apartment");
  if (!input.areaIds.length || input.areaIds.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new ServiceError(he.errors.invalid);
  const { stages: FLOW } = await loadFlow(store, s.project.organization_id, kind);
  const tradeIds = await ensureFlowTrades(store, FLOW);
  const [allAreas, orgContractors, members] = await Promise.all([
    store.select("areas", { where: { project_id: s.project.id } }),
    store.select("contractors", { where: { organization_id: s.project.organization_id } }),
    store.select("project_members", { where: { project_id: s.project.id } }),
  ]);
  const wantedIds = new Set(input.areaIds);
  const places = allAreas.filter((a) => wantedIds.has(a.id) && kindOf(a) === kind && (kind === "building" || a.type === "apartment"));

  // auto-assign only contractors who are on this project (they must be able to see their tasks)
  const memberIds = new Set(members.map((m) => m.profile_id));
  const contractors = orgContractors.filter((c) => c.profile_id && memberIds.has(c.profile_id));
  const contractorFor = (trade: string): string | null => {
    if (input.contractorByTrade && trade in input.contractorByTrade) return input.contractorByTrade[trade] ?? null;
    const tid = tradeIds.get(trade);
    const list = contractors.filter((c) => c.trade_id === tid);
    return list.length === 1 ? list[0].id : null;
  };

  // building: one sub-area per shared part (roof, lobby…), created when missing
  const partArea = async (building: AreaRow, part: string): Promise<string> => {
    const hit = allAreas.find((a) => a.parent_id === building.id && a.type === "common" && feats(a).includes(part));
    if (hit) return hit.id;
    const [created] = await store.insert("areas", {
      project_id: s.project.id,
      parent_id: building.id,
      type: "common",
      name: PARTS[part]?.name ?? part,
      sort_order: 100 + Object.keys(PARTS).indexOf(part),
      features: [part],
    });
    allAreas.push(created);
    return created.id;
  };

  const result: ApplyFlowResult = { created: 0, linked: 0, areas: 0 };
  const perContractor = new Map<string, number>();
  const ordered = [...places].sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const buildings = new Set<string>();

  for (const [i, place] of ordered.entries()) {
    const b = kind === "building" ? place : buildingOf(allAreas, place.id);
    if (b) buildings.add(b.id);
    const { stages, schedule } = planFor(FLOW, placeFeatures(allAreas, place), input.stageKeys);
    const start = addDays(input.startDate, (input.staggerDays ?? 0) * i);
    const areaIds = placeAreaIds(allAreas, place);
    const existing = await store.select("tasks", { where: { project_id: s.project.id, area_id: { in: [...areaIds] } } });
    const byStage = new Map<string, Task>();
    for (const t of existing) if (t.flow_stage) byStage.set(t.flow_stage, t);
    const toCreate = stages.filter((st) => !byStage.has(st.key));
    if (toCreate.length) {
      const rows = [];
      for (const st of toCreate) {
        const when = schedule.get(st.key)!;
        rows.push({
          title: `${st.name} – ${place.name}`,
          description: st.description,
          area_id: kind === "building" && st.part ? await partArea(place, st.part) : place.id,
          trade_id: tradeIds.get(st.trade) ?? null,
          contractor_id: contractorFor(st.trade),
          planned_start: addDays(start, when.start),
          planned_end: addDays(start, Math.max(when.start, Math.ceil(when.end) - 1)),
          flow_stage: st.key,
        });
      }
      const res = await createTasks(ctx, rows, { source: "manual", quiet: true });
      res.tasks.forEach((t, k) => {
        byStage.set(toCreate[k].key, t);
        if (t.contractor_id) perContractor.set(t.contractor_id, (perContractor.get(t.contractor_id) ?? 0) + 1);
      });
      result.created += res.tasks.length;
      result.areas++;
    }
    // dependencies exactly as the process says (skip ones that already exist)
    const ids = [...byStage.values()].map((t) => t.id);
    const deps = ids.length ? await store.select("dependencies", { where: { project_id: s.project.id, to_task_id: { in: ids } } }) : [];
    for (const st of stages) {
      const to = byStage.get(st.key)!;
      for (const a of st.after) {
        if (a.scope) continue;
        const from = byStage.get(a.key);
        if (!from || deps.some((d) => d.from_task_id === from.id && d.to_task_id === to.id)) continue;
        if (await link(ctx, from.id, to.id, a.lag ?? 0)) result.linked++;
      }
    }
  }
  // apartment ↔ building links (e.g. garden paving waits for scaffolding removal)
  result.linked += await linkCrossFlow(ctx, [...buildings]);

  // one summary message per contractor instead of one per task
  for (const [contractorId, n] of input.quiet ? [] : perContractor) {
    const sent = await messageContractor(store, s.project.id, contractorId, he.flow.assignedSummary(n, ordered.map((a) => a.name)), {});
    if (sent)
      await notify(store, [{ profileId: sent.profileId, projectId: s.project.id, kind: "assigned", title: he.notify.assignedTitle, body: he.flow.assignedSummary(n, []), link: "/my" }]);
  }
  return result;
}

async function link(ctx: Ctx, from: string, to: string, lag: number): Promise<boolean> {
  try {
    await insertDependency(ctx, { fromTaskId: from, toTaskId: to, lagHours: lag, source: "template" });
    return true;
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    return false;
  }
}

/**
 * Link apartments' stages to the building stages they wait for (hot water →
 * solar heaters, garden paving → scaffolding removal…). Idempotent; runs after
 * either process is applied, so the order of applying doesn't matter.
 */
export async function linkCrossFlow(ctx: Ctx, buildingIds: string[]): Promise<number> {
  if (!buildingIds.length) return 0;
  const { store, s } = ctx;
  const { stages: APT } = await loadFlow(store, s.project.organization_id, "apartment");
  if (!APT.some((st) => st.after.some((a) => a.scope === "building"))) return 0;
  const [areas, tasks, deps] = await Promise.all([
    store.select("areas", { where: { project_id: s.project.id } }),
    store.select("tasks", { where: { project_id: s.project.id } }),
    store.select("dependencies", { where: { project_id: s.project.id } }),
  ]);
  const flowTasks = tasks.filter((t) => t.flow_stage && t.area_id);
  const have = new Set(deps.map((d) => `${d.from_task_id}>${d.to_task_id}`));
  let linked = 0;
  for (const bid of buildingIds) {
    const building = areas.find((a) => a.id === bid);
    if (!building) continue;
    const bAreas = placeAreaIds(areas, building);
    const bTask = new Map(flowTasks.filter((t) => bAreas.has(t.area_id!)).map((t) => [t.flow_stage!, t]));
    if (!bTask.size) continue;
    const apartments = areas.filter((a) => a.type === "apartment" && buildingOf(areas, a.id)?.id === bid);
    for (const apt of apartments) {
      const aTask = new Map(flowTasks.filter((t) => t.area_id === apt.id).map((t) => [t.flow_stage!, t]));
      if (!aTask.size) continue;
      for (const st of stagesFor(APT, placeFeatures(areas, apt))) {
        const to = aTask.get(st.key);
        if (!to) continue;
        for (const a of st.after) {
          if (a.scope !== "building") continue;
          const from = bTask.get(a.key);
          if (!from || have.has(`${from.id}>${to.id}`)) continue;
          if (await link(ctx, from.id, to.id, a.lag ?? 0)) {
            have.add(`${from.id}>${to.id}`);
            linked++;
          }
        }
      }
    }
  }
  return linked;
}

function ancestorsOf(flow: FlowStage[], key: string): Set<string> {
  const byKey = new Map(flow.map((s) => [s.key, s]));
  const out = new Set<string>();
  const stack = [key];
  while (stack.length) {
    const k = stack.pop()!;
    if (out.has(k) || !byKey.has(k)) continue;
    out.add(k);
    stack.push(...byKey.get(k)!.after.filter((a) => !a.scope).map((a) => a.key));
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
 * Capture a site that is already under way: for each place (apartment or
 * building), the chosen stage and everything it requires are marked done —
 * quietly (no reports, no messages). Stages left are optionally re-dated to
 * start from `rescheduleFrom`. The process is applied first where it wasn't yet.
 */
export async function captureExisting(
  ctx: Ctx,
  input: { kind?: FlowKind; areaIds: string[]; doneUpTo: string | null; rescheduleFrom?: string | null },
): Promise<CaptureResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  const kind = assertKind(input.kind ?? "apartment");
  if (!input.areaIds.length || input.areaIds.length > 200) throw new ServiceError(he.errors.invalid);
  if (input.rescheduleFrom && !/^\d{4}-\d{2}-\d{2}$/.test(input.rescheduleFrom)) throw new ServiceError(he.errors.invalid);
  const { stages: FLOW } = await loadFlow(store, s.project.organization_id, kind);
  if (input.doneUpTo && !FLOW.some((x) => x.key === input.doneUpTo)) throw new ServiceError(he.errors.invalid);
  const now = (ctx.now ?? new Date()).toISOString();
  // work that was already done on site: backdated, so drying waits are over and it isn't "completed this week"
  const doneAt = new Date(Date.parse(now) - CAPTURED_AGE_MS).toISOString();
  const res: CaptureResult = { created: 0, marked: 0, rescheduled: 0 };

  // make sure every place has the process
  for (let i = 0; i < input.areaIds.length; i += 60) {
    const r = await applyFlow(ctx, { kind, areaIds: input.areaIds.slice(i, i + 60), startDate: input.rescheduleFrom ?? now.slice(0, 10), quiet: true });
    res.created += r.created;
  }
  const done = input.doneUpTo ? ancestorsOf(FLOW, input.doneUpTo) : new Set<string>();
  const allAreas = await store.select("areas", { where: { project_id: s.project.id } });
  const places = allAreas.filter((a) => input.areaIds.includes(a.id));
  const placeOf = new Map<string, string>();
  for (const p of places) for (const id of placeAreaIds(allAreas, p)) placeOf.set(id, p.id);
  const tasks = await store.select("tasks", { where: { project_id: s.project.id, area_id: { in: [...placeOf.keys()] } } });
  const flowKeys = new Set(FLOW.map((x) => x.key));
  const flowTasks = tasks.filter((t) => t.flow_stage && flowKeys.has(t.flow_stage));

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
      // per place: shift the open stages so the earliest starts on the given date
      for (const place of places) {
        const open = flowTasks.filter((t) => placeOf.get(t.area_id!) === place.id && !done.has(t.flow_stage!) && t.status !== "done" && t.planned_start);
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
  /** "missing": applies here but no task yet; "skip": doesn't apply here (feature not present) */
  state: EffectiveState | "missing" | "skip";
  contractor: string | null;
}

/** Live status of every process stage in one place (apartment or building). Stages that don't apply there are "skip". */
export function flowStatus(snap: ProjectSnapshot, areaId: string, flow: FlowStage[]): Record<string, StageStatus> {
  const out: Record<string, StageStatus> = {};
  const place = snap.areaById.get(areaId);
  const applies = new Set(place ? stagesFor(flow, placeFeatures(snap.areas, place)).map((x) => x.key) : flow.map((x) => x.key));
  for (const st of flow) out[st.key] = { key: st.key, taskId: null, state: applies.has(st.key) ? "missing" : "skip", contractor: null };
  const areaIds = place ? placeAreaIds(snap.areas, place) : new Set([areaId]);
  for (const t of snap.tasks) {
    if (!t.area_id || !areaIds.has(t.area_id) || !t.flow_stage || !out[t.flow_stage]) continue;
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

/**
 * Turn features on/off for apartments (garden, duplex) or buildings (parking,
 * elevator, sprinklers). Places that already have the process get the stages
 * that now apply added right away (quietly).
 */
export async function setFeatures(ctx: Ctx, input: { areaIds: string[]; add: string[]; remove: string[] }): Promise<{ updated: number; created: number }> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!input.areaIds.length || input.areaIds.length > 300) throw new ServiceError(he.errors.invalid);
  const areas = await store.select("areas", { where: { project_id: s.project.id } });
  const places = areas.filter((a) => input.areaIds.includes(a.id) && (a.type === "apartment" || a.type === "building"));
  let updated = 0;
  for (const p of places) {
    const of = p.type === "building" ? "building" : "apartment";
    const ok = (f: string) => FEATURES[f]?.of === of;
    const next = [...new Set([...feats(p).filter((f) => !input.remove.includes(f)), ...input.add.filter(ok)])];
    if (next.length === feats(p).length && next.every((f) => feats(p).includes(f))) continue;
    await store.update("areas", { id: p.id }, { features: next });
    p.features = next;
    updated++;
  }
  // add the stages that now apply where the process is already in use
  const flowAreas = new Set((await store.select("tasks", { where: { project_id: s.project.id } })).filter((t) => t.flow_stage).map((t) => t.area_id));
  let created = 0;
  for (const kind of ["apartment", "building"] as const) {
    const ids = places.filter((p) => kindOf(p) === kind && [...placeAreaIds(areas, p)].some((id) => flowAreas.has(id))).map((p) => p.id);
    for (let i = 0; i < ids.length; i += 60)
      created += (await applyFlow(ctx, { kind, areaIds: ids.slice(i, i + 60), startDate: (ctx.now ?? new Date()).toISOString().slice(0, 10), quiet: true })).created;
  }
  return { updated, created };
}
