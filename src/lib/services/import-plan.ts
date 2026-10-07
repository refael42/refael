/**
 * Import a work plan spreadsheet (lib/import/plan.ts) into the current project:
 * building areas, contractors (with phones from the contacts table), tasks with
 * their statuses, dates and dependencies. Tasks remember their sheet number
 * (external_ref), so importing an updated sheet updates the same tasks.
 *
 * "Done" rows the manager hasn't checked come in as awaiting approval with a
 * completion report, so the PM confirms them in the approvals inbox.
 */
import type { Area, Task, TaskStatus } from "../db/types";
import { FLOW_TRADES } from "../flow/process";
import { he } from "../i18n/he";
import {
  classifyLocation,
  EXTRA_TRADES,
  matchPerson,
  splitResponsible,
  tradeKeyFor,
  type Plan,
  type PlanStatus,
  type PlanTask,
} from "../import/plan";
import { normalizePhone } from "../phone";
import { assertPM } from "./access";
import { audit } from "./audit";
import { releaseReady } from "./release";
import { createContractor } from "./settings";
import { insertDependency, ServiceError, type Ctx } from "./tasks";

export interface ImportResult {
  created: number;
  updated: number;
  areas: number;
  contractors: number;
  dependencies: number;
  /** imported dependencies no longer in the sheet (re-import) */
  removedDependencies: number;
  awaitingApproval: number;
  warnings: string[];
}

const RANK: Record<TaskStatus, number> = { planned: 0, ready: 0, blocked_manual: 1, in_progress: 2, awaiting_approval: 3, done: 4 };
const TO_STATUS: Record<PlanStatus, TaskStatus> = {
  planned: "planned",
  in_progress: "in_progress",
  awaiting_approval: "awaiting_approval",
  done: "done",
  blocked: "blocked_manual",
};

/** Building name from a title like "תוכנית עבודה … - אימבר 16". */
export function buildingNameFrom(plan: Plan, fallback: string): string {
  const t = plan.title?.split(/\s+[-–]\s+/).pop()?.trim();
  return t && t.length <= 40 ? t : fallback;
}

export async function importPlan(
  ctx: Ctx,
  plan: Plan,
  opts: {
    buildingName?: string;
    /** import the sheet's dependency column (default true) */
    dependencies?: boolean;
  } = {},
): Promise<ImportResult> {
  assertPM(ctx.s);
  const { store, s } = ctx;
  if (!plan.tasks.length) throw new ServiceError(he.importPlan.noTasks);
  if (plan.tasks.length > 3000) throw new ServiceError(he.errors.invalid);
  const now = ctx.now ?? new Date();
  const res: ImportResult = { created: 0, updated: 0, areas: 0, contractors: 0, dependencies: 0, removedDependencies: 0, awaitingApproval: 0, warnings: [...plan.warnings] };

  // ── building + areas ──
  const areas = await store.select("areas", { where: { project_id: s.project.id } });
  const bname = (opts.buildingName ?? buildingNameFrom(plan, s.project.name)).trim();
  const addArea = async (row: Partial<Area>) => {
    const [a] = await store.insert("areas", { project_id: s.project.id, ...row });
    areas.push(a);
    res.areas++;
    return a;
  };
  const building = areas.find((a) => a.type === "building" && a.name === bname) ?? areas.find((a) => a.type === "building") ?? (await addArea({ type: "building", name: bname, parent_id: null, sort_order: 1 }));
  const inBuilding = (type: Area["type"], name: string) => areas.find((a) => a.type === type && a.name === name && isUnder(areas, a, building.id));
  const areaFor = async (t: PlanTask): Promise<{ id: string; name: string }> => {
    const p = classifyLocation(t.location);
    if (p.kind === "building") return building;
    if (p.kind === "apartment") {
      const hit = inBuilding("apartment", p.name);
      if (hit) return hit;
      const num = Number(p.name.match(/\d+/)?.[0] ?? 900);
      return addArea({ type: "apartment", name: p.name, parent_id: building.id, sort_order: num, features: p.garden ? ["garden"] : [] });
    }
    if (p.kind === "floor") return inBuilding("floor", p.name) ?? addArea({ type: "floor", name: p.name, parent_id: building.id, sort_order: Number(p.name.match(/\d+/)?.[0] ?? 0) });
    const byPart = p.part ? areas.find((a) => a.parent_id === building.id && a.type === "common" && (a.features ?? []).includes(p.part!)) : undefined;
    return byPart ?? inBuilding("common", p.name) ?? addArea({ type: "common", name: p.name, parent_id: building.id, sort_order: 100, features: p.part ? [p.part] : [] });
  };

  // ── trades ──
  const trades = await store.select("trades");
  const tradeIds = new Map<string, string>(); // work type → trade id
  const tradeFor = async (workType: string): Promise<string | null> => {
    if (!workType) return null;
    if (tradeIds.has(workType)) return tradeIds.get(workType)!;
    const key = tradeKeyFor(workType);
    let trade = key ? trades.find((x) => x.key === key) : trades.find((x) => x.name === workType);
    if (!trade) {
      const known = key ? FLOW_TRADES.find((x) => x.key === key) ?? (EXTRA_TRADES[key] && { key, ...EXTRA_TRADES[key] }) : null;
      [trade] = await store.insert("trades", {
        key: known?.key ?? `t_${trades.length}_${Date.now().toString(36)}`,
        name: known?.name ?? workType,
        color: known?.color ?? "#64748b",
        sort_order: trades.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1,
      });
      trades.push(trade);
    }
    tradeIds.set(workType, trade.id);
    return trade.id;
  };

  // ── contractors ──
  const allNames = [...new Set(plan.tasks.flatMap((t) => splitResponsible(t.responsible)))];
  const orgContractors = await store.select("contractors", { where: { organization_id: s.project.organization_id } });
  const contractorIds = new Map<string, string>();
  const contractorFor = async (name: string, workType: string): Promise<string | null> => {
    if (!name) return null;
    if (contractorIds.has(name)) return contractorIds.get(name)!;
    const person = matchPerson(name, plan.people, allNames);
    const phone = normalizePhone(person?.phone);
    let c = orgContractors.find((x) => (phone && x.phone === phone) || x.name === name);
    if (!c) {
      // the trade they do most in this plan
      const counts = new Map<string, number>();
      for (const t of plan.tasks) if (splitResponsible(t.responsible)[0] === name && t.workType) counts.set(t.workType, (counts.get(t.workType) ?? 0) + 1);
      const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? workType;
      const trade_id = await tradeFor(main);
      if (phone) c = await createContractor(ctx, { name, phone, trade_id, company: person?.company || null });
      else
        [c] = await store.insert("contractors", { organization_id: s.project.organization_id, profile_id: null, name, phone: null, trade_id, company: person?.company || null });
      orgContractors.push(c);
      res.contractors++;
    }
    contractorIds.set(name, c.id);
    return c.id;
  };

  // ── tasks ──
  const existing = new Map(
    (await store.select("tasks", { where: { project_id: s.project.id } })).filter((t) => t.external_ref).map((t) => [t.external_ref!, t] as const),
  );
  const byRef = new Map<string, Task>();
  const iso = (d: string | null) => (d ? `${d}T12:00:00.000Z` : null);
  for (const t of plan.tasks) {
    const area = await areaFor(t);
    const people = splitResponsible(t.responsible);
    const contractor_id = await contractorFor(people[0] ?? "", t.workType);
    const trade_id = await tradeFor(t.workType);
    const lines = [
      t.note,
      t.location && t.location !== area.name ? `${he.importPlan.location}: ${t.location}` : "",
      people.length > 1 ? `${he.importPlan.alsoResponsible}: ${people.slice(1).join(", ")}` : "",
      t.statusLabel ? `${he.importPlan.sheetStatus}: ${t.statusLabel}` : "",
      t.status === "in_progress" && t.percent ? he.importPlan.percent(Math.round(t.percent * 100)) : "",
      `${he.importPlan.sheetNumber}: ${t.number} (${t.sheet})`,
    ].filter(Boolean);
    const status = TO_STATUS[t.status];
    const doneAt = iso(t.end ?? t.start) ?? new Date(now.getTime() - 86_400_000).toISOString();
    const fields = {
      title: t.title.slice(0, 300),
      description: lines.join("\n"),
      area_id: area.id,
      trade_id,
      planned_start: t.start,
      planned_end: t.end,
    };
    const prev = existing.get(t.ref);
    if (!prev) {
      const [row] = await store.insert("tasks", {
        project_id: s.project.id,
        ...fields,
        contractor_id,
        status,
        external_ref: t.ref,
        started_at: status === "in_progress" ? iso(t.start) ?? now.toISOString() : null,
        completed_at: status === "done" || status === "awaiting_approval" ? doneAt : null,
        blocked_reason: status === "blocked_manual" ? t.note || t.statusLabel || he.importPlan.blocked : null,
        created_by: s.profile.id,
      });
      byRef.set(t.ref, row);
      res.created++;
    } else {
      // the sheet moves a task forward, never back (work recorded in the app stays)
      const forward = RANK[status] > RANK[prev.status];
      const patch: Partial<Task> = { ...fields, contractor_id: prev.contractor_id ?? contractor_id };
      if (forward) {
        patch.status = status;
        if (status === "in_progress" && !prev.started_at) patch.started_at = iso(t.start) ?? now.toISOString();
        if (status === "done" || status === "awaiting_approval") patch.completed_at = doneAt;
        if (status === "blocked_manual") patch.blocked_reason = t.note || t.statusLabel || he.importPlan.blocked;
      }
      const [row] = await store.update("tasks", { id: prev.id }, patch);
      byRef.set(t.ref, row);
      res.updated++;
    }
    const row = byRef.get(t.ref)!;
    if (row.status === "awaiting_approval" && !(await store.first("completion_reports", { where: { task_id: row.id, status: "pending" } }))) {
      await store.insert("completion_reports", {
        task_id: row.id,
        contractor_id: row.contractor_id,
        submitted_by: s.profile.id,
        photo_urls: [],
        note: he.importPlan.reportNote,
        status: "pending",
      });
      res.awaitingApproval++;
    }
  }

  // ── dependencies ──
  // the sheet decides the dependencies it brought in: ones it no longer lists are removed
  // (dependencies added in the app are never touched)
  const wanted = new Set<string>();
  if (opts.dependencies !== false)
    for (const t of plan.tasks)
      for (const ref of t.dependsOn) {
        const from = byRef.get(ref);
        if (from) wanted.add(`${from.id}>${byRef.get(t.ref)!.id}`);
      }
  const deps = await store.select("dependencies", { where: { project_id: s.project.id } });
  const stale = deps.filter((d) => d.source === "import" && !wanted.has(`${d.from_task_id}>${d.to_task_id}`));
  if (stale.length) {
    await store.remove("dependencies", { id: { in: stale.map((d) => d.id) } });
    res.removedDependencies = stale.length;
  }
  const have = new Set(deps.filter((d) => !stale.includes(d)).map((d) => `${d.from_task_id}>${d.to_task_id}`));
  for (const t of opts.dependencies === false ? [] : plan.tasks) {
    const to = byRef.get(t.ref)!;
    for (const ref of t.dependsOn) {
      const from = byRef.get(ref);
      if (!from || have.has(`${from.id}>${to.id}`)) continue;
      try {
        await insertDependency(ctx, { fromTaskId: from.id, toTaskId: to.id, source: "import" });
        have.add(`${from.id}>${to.id}`);
        res.dependencies++;
      } catch (e) {
        if (!(e instanceof ServiceError)) throw e;
        res.warnings.push(he.importPlan.depSkipped(t.number, ref.split("#")[1], e.message));
      }
    }
  }

  // tasks whose prerequisites are all done are ready now (quietly — nobody is messaged)
  await releaseReady(store, s.project.id, { actor: s.profile.id, source: "manual", now, quiet: true });
  await audit(store, {
    projectId: s.project.id,
    entityType: "project",
    entityId: s.project.id,
    action: "plan_imported",
    to: `${res.created}+${res.updated}`,
    actor: s.profile.id,
    source: "manual",
    meta: { title: plan.title },
  });
  return res;
}

function isUnder(areas: Area[], a: Area, ancestorId: string): boolean {
  for (let cur: Area | undefined = a; cur; cur = cur.parent_id ? areas.find((x) => x.id === cur!.parent_id) : undefined) if (cur.id === ancestorId) return true;
  return false;
}
