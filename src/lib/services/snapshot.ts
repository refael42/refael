import { analyze, recommendToday, unlockImpact, type EngineInput, type ProjectAnalysis } from "../engine";
import type { Store } from "../db/store";
import type {
  Area,
  Contractor,
  Dependency,
  ExternalBlocker,
  Project,
  Profile,
  ProjectMember,
  Task,
  Trade,
} from "../db/types";

/** Everything the dependency engine and most screens need for one project. */
export interface ProjectSnapshot {
  project: Project;
  tasks: Task[];
  dependencies: Dependency[];
  blockers: ExternalBlocker[];
  areas: Area[];
  trades: Trade[];
  contractors: Contractor[];
  members: ProjectMember[];
  profiles: Profile[];
  now: Date;
  analysis: ProjectAnalysis;
  // lookups
  taskById: Map<string, Task>;
  areaById: Map<string, Area>;
  tradeById: Map<string, Trade>;
  contractorById: Map<string, Contractor>;
  blockerById: Map<string, ExternalBlocker>;
  profileById: Map<string, Profile>;
}

export function toEngineInput(
  tasks: Task[],
  dependencies: Dependency[],
  blockers: ExternalBlocker[],
  now: Date,
): EngineInput {
  return {
    now,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      contractorId: t.contractor_id,
      plannedStart: t.planned_start,
      plannedEnd: t.planned_end,
      completedAt: t.completed_at,
      blockedReason: t.blocked_reason,
      isCritical: t.is_critical,
    })),
    dependencies: dependencies.map((d) => ({
      id: d.id,
      fromTaskId: d.from_task_id,
      fromBlockerId: d.from_blocker_id,
      toTaskId: d.to_task_id,
      lagHours: Number(d.lag_hours) || 0,
    })),
    blockers: blockers.map((b) => ({
      id: b.id,
      title: b.title,
      ownerName: b.owner_name,
      status: b.status,
      expectedDate: b.expected_date,
    })),
  };
}

export async function loadGraph(store: Store, projectId: string) {
  const [tasks, dependencies, blockers] = await Promise.all([
    store.select("tasks", { where: { project_id: projectId }, order: [["created_at", "asc"], ["id", "asc"]] }),
    store.select("dependencies", { where: { project_id: projectId } }),
    store.select("external_blockers", { where: { project_id: projectId } }),
  ]);
  return { tasks, dependencies, blockers };
}

export async function analyzeProject(store: Store, projectId: string, now = new Date()) {
  const g = await loadGraph(store, projectId);
  return { ...g, analysis: analyze(toEngineInput(g.tasks, g.dependencies, g.blockers, now)) };
}

export async function loadSnapshot(store: Store, projectId: string, now = new Date()): Promise<ProjectSnapshot> {
  const project = await store.byId("projects", projectId);
  if (!project) throw new Error("project not found");
  const [graph, areas, trades, contractors, members] = await Promise.all([
    loadGraph(store, projectId),
    store.select("areas", { where: { project_id: projectId }, order: [["sort_order", "asc"], ["name", "asc"]] }),
    store.select("trades", { order: [["sort_order", "asc"]] }),
    store.select("contractors", { where: { organization_id: project.organization_id }, order: [["name", "asc"]] }),
    store.select("project_members", { where: { project_id: projectId } }),
  ]);
  const profiles = members.length
    ? await store.select("profiles", { where: { id: { in: members.map((m) => m.profile_id) } } })
    : [];
  const analysis = analyze(toEngineInput(graph.tasks, graph.dependencies, graph.blockers, now));
  return {
    project,
    ...graph,
    areas,
    trades,
    contractors,
    members,
    profiles,
    now,
    analysis,
    taskById: new Map(graph.tasks.map((t) => [t.id, t])),
    areaById: new Map(areas.map((a) => [a.id, a])),
    tradeById: new Map(trades.map((t) => [t.id, t])),
    contractorById: new Map(contractors.map((c) => [c.id, c])),
    blockerById: new Map(graph.blockers.map((b) => [b.id, b])),
    profileById: new Map(profiles.map((p) => [p.id, p])),
  };
}

export function snapshotRecommendation(s: ProjectSnapshot, k = 3) {
  const input = toEngineInput(s.tasks, s.dependencies, s.blockers, s.now);
  return recommendToday(input, k, s.analysis);
}

export function snapshotUnlockImpact(s: ProjectSnapshot) {
  const input = toEngineInput(s.tasks, s.dependencies, s.blockers, s.now);
  return unlockImpact(input, s.analysis);
}

// ───────── area helpers ─────────

/** The area and all its descendants. */
export function areaSubtree(areas: Area[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const a of areas) if (a.parent_id) (children.get(a.parent_id) ?? children.set(a.parent_id, []).get(a.parent_id)!).push(a.id);
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/** Ancestors from the root down to (and including) the area. */
export function areaPath(areaById: Map<string, Area>, id: string | null): Area[] {
  const path: Area[] = [];
  const seen = new Set<string>();
  for (let cur = id ? areaById.get(id) : undefined; cur && !seen.has(cur.id); cur = cur.parent_id ? areaById.get(cur.parent_id) : undefined) {
    seen.add(cur.id);
    path.unshift(cur);
  }
  return path;
}

/** Short label like "קומה 4 › דירה 17". Skips the building level. */
export function areaLabel(areaById: Map<string, Area>, id: string | null): string {
  const path = areaPath(areaById, id).filter((a) => a.type !== "building" || areaPath(areaById, id).length === 1);
  return path.map((a) => a.name).join(" › ");
}

/** Two areas overlap when one contains the other (or they are equal). */
export function areasOverlap(areaById: Map<string, Area>, a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const pa = areaPath(areaById, a).map((x) => x.id);
  const pb = areaPath(areaById, b).map((x) => x.id);
  return pa.includes(b) || pb.includes(a);
}
