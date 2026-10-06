/**
 * Engine 1 — dependency & status engine.
 *
 * Pure, deterministic TypeScript (no I/O, no AI, no clock): every function takes
 * the graph plus `now` and returns plain data. Unit-tested in engine.test.ts.
 *
 *  - effective state: a task is "ready" only if every predecessor is done (and
 *    its lag has elapsed) and no open external blocker feeds it; otherwise
 *    "blocked" with the exact list of blocking items and who must act.
 *  - cycle detection (Tarjan SCC) and pre-insert validation.
 *  - blocking counts (direct / transitive) and CPM critical path on remaining work.
 *  - unlock impact + "do these today to unlock the most" recommendation.
 *  - release diff: which tasks became ready after a change.
 */
import type {
  BlockingItem,
  Bottleneck,
  EffectiveState,
  EngineBlocker,
  EngineDependency,
  EngineInput,
  EngineTask,
  ProjectAnalysis,
  RootBlocker,
  TaskAnalysis,
  UnlockImpact,
} from "./types";

export * from "./types";

const HOUR = 3_600_000;
const DAY_H = 24;
const EPS = 0.01;

// ───────────────────────── graph indexing ─────────────────────────

interface Graph {
  tasks: Map<string, EngineTask>;
  blockers: Map<string, EngineBlocker>;
  /** incoming edges per task */
  incoming: Map<string, EngineDependency[]>;
  /** outgoing task→task edges per task */
  outgoing: Map<string, EngineDependency[]>;
  /** outgoing blocker→task edges per blocker */
  blockerOut: Map<string, EngineDependency[]>;
}

function buildGraph(input: Pick<EngineInput, "tasks" | "dependencies" | "blockers">): Graph {
  const tasks = new Map(input.tasks.map((t) => [t.id, t]));
  const blockers = new Map((input.blockers ?? []).map((b) => [b.id, b]));
  const incoming = new Map<string, EngineDependency[]>();
  const outgoing = new Map<string, EngineDependency[]>();
  const blockerOut = new Map<string, EngineDependency[]>();
  for (const t of input.tasks) {
    incoming.set(t.id, []);
    outgoing.set(t.id, []);
  }
  // Stable order regardless of input order → deterministic output.
  const deps = [...input.dependencies].sort((a, b) => a.id.localeCompare(b.id));
  for (const d of deps) {
    if (!tasks.has(d.toTaskId)) continue; // dangling edge
    if (d.fromTaskId) {
      if (!tasks.has(d.fromTaskId)) continue;
      incoming.get(d.toTaskId)!.push(d);
      outgoing.get(d.fromTaskId)!.push(d);
    } else if (d.fromBlockerId) {
      if (!blockers.has(d.fromBlockerId)) continue;
      incoming.get(d.toTaskId)!.push(d);
      if (!blockerOut.has(d.fromBlockerId)) blockerOut.set(d.fromBlockerId, []);
      blockerOut.get(d.fromBlockerId)!.push(d);
    }
  }
  return { tasks, blockers, incoming, outgoing, blockerOut };
}

// ───────────────────────── cycles ─────────────────────────

/** Strongly connected components with >1 node (or a self loop). */
export function detectCycles(tasks: Pick<EngineTask, "id">[], dependencies: EngineDependency[]): string[][] {
  const ids = tasks.map((t) => t.id).sort();
  const known = new Set(ids);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const selfLoops = new Set<string>();
  for (const d of dependencies) {
    if (!d.fromTaskId || !known.has(d.fromTaskId) || !known.has(d.toTaskId)) continue;
    if (d.fromTaskId === d.toTaskId) selfLoops.add(d.fromTaskId);
    adj.get(d.fromTaskId)!.push(d.toTaskId);
  }
  for (const list of adj.values()) list.sort();

  // Iterative Tarjan (no recursion → safe on long chains).
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];

  for (const root of ids) {
    if (idx.has(root)) continue;
    const work: Array<{ v: string; i: number }> = [{ v: root, i: 0 }];
    idx.set(root, index);
    low.set(root, index++);
    stack.push(root);
    onStack.add(root);
    while (work.length) {
      const frame = work[work.length - 1];
      const nexts = adj.get(frame.v)!;
      if (frame.i < nexts.length) {
        const w = nexts[frame.i++];
        if (!idx.has(w)) {
          idx.set(w, index);
          low.set(w, index++);
          stack.push(w);
          onStack.add(w);
          work.push({ v: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.v, Math.min(low.get(frame.v)!, idx.get(w)!));
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1].v;
          low.set(parent, Math.min(low.get(parent)!, low.get(frame.v)!));
        }
        if (low.get(frame.v) === idx.get(frame.v)) {
          const comp: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            comp.push(w);
          } while (w !== frame.v);
          if (comp.length > 1 || selfLoops.has(comp[0])) out.push(comp.sort());
        }
      }
    }
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

export type EdgeCheck = { ok: true } | { ok: false; reason: "self" | "cycle" | "duplicate"; path?: string[] };

/**
 * Validate a new task→task edge before inserting it. Returns the existing path
 * to→…→from when the edge would close a cycle.
 */
export function validateNewDependency(dependencies: EngineDependency[], fromTaskId: string, toTaskId: string): EdgeCheck {
  if (fromTaskId === toTaskId) return { ok: false, reason: "self", path: [fromTaskId] };
  if (dependencies.some((d) => d.fromTaskId === fromTaskId && d.toTaskId === toTaskId))
    return { ok: false, reason: "duplicate" };
  const out = new Map<string, string[]>();
  for (const d of dependencies) {
    if (!d.fromTaskId) continue;
    if (!out.has(d.fromTaskId)) out.set(d.fromTaskId, []);
    out.get(d.fromTaskId)!.push(d.toTaskId);
  }
  // BFS from `to`; reaching `from` means from→to would close a loop.
  const prev = new Map<string, string | null>([[toTaskId, null]]);
  const queue = [toTaskId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === fromTaskId) {
      const path: string[] = [];
      for (let p: string | null = cur; p !== null; p = prev.get(p) ?? null) path.unshift(p);
      return { ok: false, reason: "cycle", path };
    }
    for (const n of (out.get(cur) ?? []).sort()) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  return { ok: true };
}

// ───────────────────────── effective state ─────────────────────────

function baseState(t: EngineTask): EffectiveState | null {
  if (t.status === "done") return "done";
  if (t.status === "awaiting_approval") return "awaiting_approval";
  return null;
}

function directBlockers(g: Graph, t: EngineTask, nowMs: number, states: Map<string, EffectiveState>): BlockingItem[] {
  const items: BlockingItem[] = [];
  if (t.status === "blocked_manual") items.push({ kind: "manual", reason: t.blockedReason ?? null });
  for (const d of g.incoming.get(t.id) ?? []) {
    if (d.fromBlockerId) {
      const b = g.blockers.get(d.fromBlockerId)!;
      if (b.status === "open") items.push({ kind: "external", blockerId: b.id, title: b.title, ownerName: b.ownerName ?? null });
      continue;
    }
    const p = g.tasks.get(d.fromTaskId!)!;
    if (p.status !== "done") {
      const state = states.get(p.id) ?? "blocked";
      items.push({
        kind: "task",
        taskId: p.id,
        title: p.title,
        state,
        contractorId: p.contractorId ?? null,
        needsPm: state === "awaiting_approval",
      });
      continue;
    }
    const lag = d.lagHours ?? 0;
    if (lag > 0 && p.completedAt) {
      const until = Date.parse(p.completedAt) + lag * HOUR;
      if (until > nowMs) items.push({ kind: "lag", taskId: p.id, title: p.title, until: new Date(until).toISOString() });
    }
  }
  return items;
}

/**
 * Compute effective states. Blocked/ready only depends on whether predecessors
 * are *done* (a stored fact), so a single pass suffices; the predecessor
 * state attached to each blocking item is filled in a second pass.
 */
function computeStates(g: Graph, nowMs: number) {
  const states = new Map<string, EffectiveState>();
  const blocked = new Map<string, BlockingItem[]>();
  for (const t of g.tasks.values()) {
    const base = baseState(t);
    if (base) {
      states.set(t.id, base);
      continue;
    }
    const items = directBlockers(g, t, nowMs, new Map());
    if (t.status === "in_progress") states.set(t.id, "in_progress");
    else states.set(t.id, items.length ? "blocked" : "ready");
  }
  for (const t of g.tasks.values()) {
    if (states.get(t.id) === "done" || states.get(t.id) === "awaiting_approval") {
      blocked.set(t.id, []);
      continue;
    }
    blocked.set(t.id, directBlockers(g, t, nowMs, states));
  }
  return { states, blocked };
}

function computeRoots(
  g: Graph,
  states: Map<string, EffectiveState>,
  blocked: Map<string, BlockingItem[]>,
): Map<string, RootBlocker[]> {
  const memo = new Map<string, RootBlocker[]>();
  const visiting = new Set<string>();

  const keyOf = (r: RootBlocker) =>
    r.kind === "external" ? `x:${r.blockerId}` : r.kind === "manual" ? `m:${r.taskId}` : `${r.kind}:${r.taskId}`;

  const rootsOf = (taskId: string): RootBlocker[] => {
    if (memo.has(taskId)) return memo.get(taskId)!;
    if (visiting.has(taskId)) return []; // cycle guard
    visiting.add(taskId);
    const t = g.tasks.get(taskId)!;
    const acc = new Map<string, RootBlocker>();
    for (const item of blocked.get(taskId) ?? []) {
      let found: RootBlocker[] = [];
      if (item.kind === "external") found = [item];
      else if (item.kind === "lag") found = [item];
      else if (item.kind === "manual") found = [{ kind: "manual", taskId, title: t.title, reason: item.reason }];
      else {
        const s = states.get(item.taskId)!;
        if (s === "blocked") {
          found = rootsOf(item.taskId);
        } else {
          found = [
            {
              kind: "task",
              taskId: item.taskId,
              title: item.title,
              state: s,
              contractorId: item.contractorId,
              needsPm: s === "awaiting_approval",
            },
          ];
        }
      }
      for (const r of found) acc.set(keyOf(r), r);
    }
    visiting.delete(taskId);
    const list = [...acc.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    memo.set(taskId, list);
    return list;
  };

  for (const id of g.tasks.keys()) {
    const s = states.get(id);
    memo.has(id) || (s === "blocked" || s === "in_progress" ? rootsOf(id) : memo.set(id, []));
  }
  return memo;
}

// ───────────────────────── downstream counts ─────────────────────────

function downstreamOf(g: Graph, startIds: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...startIds];
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    const t = g.tasks.get(cur);
    if (!t || t.status === "done") continue; // a done task blocks nothing further
    seen.add(cur);
    for (const d of g.outgoing.get(cur) ?? []) queue.push(d.toTaskId);
  }
  return seen;
}

// ───────────────────────── CPM schedule ─────────────────────────

function dayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function durationHours(t: EngineTask, nowMs: number): number {
  return baseDurationHours(t, nowMs) + (t.status === "done" ? 0 : Math.max(0, t.delayHours ?? 0));
}

function baseDurationHours(t: EngineTask, nowMs: number): number {
  if (t.status === "done" || t.status === "awaiting_approval") return 0;
  const full =
    t.plannedStart && t.plannedEnd
      ? Math.max(1, Math.round((dayStartMs(t.plannedEnd) - dayStartMs(t.plannedStart)) / (DAY_H * HOUR)) + 1) * DAY_H
      : DAY_H;
  if (t.status === "in_progress") {
    if (!t.plannedEnd) return full / 2;
    const remaining = (dayStartMs(t.plannedEnd) + DAY_H * HOUR - nowMs) / HOUR;
    return Math.max(8, remaining);
  }
  return full;
}

function schedule(g: Graph, nowMs: number, cycleNodes: Set<string>) {
  const open = [...g.tasks.values()].filter((t) => t.status !== "done" && !cycleNodes.has(t.id));
  const openIds = new Set(open.map((t) => t.id));
  const dur = new Map(open.map((t) => [t.id, durationHours(t, nowMs)]));

  // Kahn topological order over open tasks (ties broken by id → deterministic)
  const indeg = new Map(open.map((t) => [t.id, 0]));
  for (const t of open)
    for (const d of g.incoming.get(t.id) ?? []) if (d.fromTaskId && openIds.has(d.fromTaskId)) indeg.set(t.id, indeg.get(t.id)! + 1);
  const ready = open.filter((t) => indeg.get(t.id) === 0).map((t) => t.id).sort();
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const d of g.outgoing.get(id) ?? []) {
      if (!openIds.has(d.toTaskId)) continue;
      indeg.set(d.toTaskId, indeg.get(d.toTaskId)! - 1);
      if (indeg.get(d.toTaskId) === 0) {
        ready.push(d.toTaskId);
        ready.sort();
      }
    }
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    let start = 0;
    for (const d of g.incoming.get(id) ?? []) {
      const lag = d.lagHours ?? 0;
      if (d.fromBlockerId) {
        const b = g.blockers.get(d.fromBlockerId)!;
        if (b.status === "open" && b.expectedDate) start = Math.max(start, (dayStartMs(b.expectedDate) - nowMs) / HOUR);
        continue;
      }
      const p = g.tasks.get(d.fromTaskId!)!;
      if (openIds.has(p.id)) start = Math.max(start, ef.get(p.id)! + lag);
      else if (p.status === "done" && p.completedAt) start = Math.max(start, (Date.parse(p.completedAt) + lag * HOUR - nowMs) / HOUR);
    }
    es.set(id, start);
    ef.set(id, start + dur.get(id)!);
  }
  const projectEnd = order.reduce((m, id) => Math.max(m, ef.get(id)!), 0);

  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    let finish = projectEnd;
    for (const d of g.outgoing.get(id) ?? []) {
      if (!openIds.has(d.toTaskId) || !ls.has(d.toTaskId)) continue;
      finish = Math.min(finish, ls.get(d.toTaskId)! - (d.lagHours ?? 0));
    }
    lf.set(id, finish);
    ls.set(id, finish - dur.get(id)!);
  }
  return { es, ef, ls, dur, projectEnd, order };
}

// ───────────────────────── analysis ─────────────────────────

export function analyze(input: EngineInput): ProjectAnalysis {
  const nowMs = input.now.getTime();
  const g = buildGraph(input);
  const cycles = detectCycles(input.tasks, input.dependencies);
  const cycleNodes = new Set(cycles.flat());
  const { states, blocked } = computeStates(g, nowMs);
  const roots = computeRoots(g, states, blocked);
  const sched = schedule(g, nowMs, cycleNodes);

  const byTask: Record<string, TaskAnalysis> = {};
  const ids = [...g.tasks.keys()].sort();
  for (const id of ids) {
    const t = g.tasks.get(id)!;
    const state = states.get(id)!;
    const succ = (g.outgoing.get(id) ?? []).map((d) => d.toTaskId);
    const pred = (g.incoming.get(id) ?? []).filter((d) => d.fromTaskId).map((d) => d.fromTaskId!);
    const isDone = state === "done";
    const directOpen = isDone ? 0 : new Set(succ.filter((s) => g.tasks.get(s)!.status !== "done")).size;
    const downstream = isDone ? 0 : downstreamOf(g, succ).size;
    const es = sched.es.get(id) ?? 0;
    const ef = sched.ef.get(id) ?? es;
    const slack = sched.ls.has(id) ? sched.ls.get(id)! - es : Infinity;
    const blockedBy = state === "ready" || state === "done" || state === "awaiting_approval" ? [] : blocked.get(id)!;
    byTask[id] = {
      id,
      effective: state,
      blockedBy: state === "in_progress" ? blockedBy.filter((b) => b.kind !== "manual") : blockedBy,
      rootBlockers: state === "blocked" ? roots.get(id) ?? [] : state === "in_progress" ? roots.get(id) ?? [] : [],
      outOfOrder: state === "in_progress" && blockedBy.length > 0,
      predecessorIds: pred,
      successorIds: succ,
      blocksDirect: directOpen,
      blocksTransitive: downstream,
      onCriticalPath: !isDone && !cycleNodes.has(id) && slack <= EPS,
      inCycle: cycleNodes.has(id),
      earlyStart: es,
      earlyFinish: ef,
      slackHours: Number.isFinite(slack) ? Math.max(0, slack) : 0,
      durationHours: sched.dur.get(id) ?? 0,
    };
  }

  const pick = (s: EffectiveState) => ids.filter((id) => byTask[id].effective === s);
  const criticalPath = ids
    .filter((id) => byTask[id].onCriticalPath)
    .sort((a, b) => byTask[a].earlyStart - byTask[b].earlyStart || a.localeCompare(b));

  return {
    now: input.now.toISOString(),
    byTask,
    readyIds: pick("ready"),
    blockedIds: pick("blocked"),
    inProgressIds: pick("in_progress"),
    awaitingIds: pick("awaiting_approval"),
    doneIds: pick("done"),
    criticalPath,
    projectEndHours: sched.projectEnd,
    cycles,
    bottlenecks: computeBottlenecks(g, byTask, input.today ?? input.now.toISOString().slice(0, 10)),
  };
}

function computeBottlenecks(g: Graph, byTask: Record<string, TaskAnalysis>, today: string): Bottleneck[] {
  const out: Bottleneck[] = [];
  const critical = (set: Set<string>) => [...set].some((id) => byTask[id]?.onCriticalPath);

  for (const b of [...g.blockers.values()].sort((a, c) => a.id.localeCompare(c.id))) {
    if (b.status !== "open") continue;
    const direct = (g.blockerOut.get(b.id) ?? []).map((d) => d.toTaskId).filter((id) => g.tasks.get(id)!.status !== "done");
    if (!direct.length) continue;
    const down = downstreamOf(g, direct);
    out.push({
      kind: "external",
      id: b.id,
      title: b.title,
      actor: { type: "owner", name: b.ownerName ?? null },
      reason: "external",
      blocksDirect: new Set(direct).size,
      blocksTransitive: down.size,
      blocksCritical: critical(down),
    });
  }

  for (const t of [...g.tasks.values()].sort((a, c) => a.id.localeCompare(c.id))) {
    const a = byTask[t.id];
    if (a.effective === "done" || a.effective === "blocked" && t.status !== "blocked_manual") continue;
    const down = downstreamOf(g, a.successorIds);
    const base = {
      kind: "task" as const,
      id: t.id,
      title: t.title,
      blocksDirect: a.blocksDirect,
      blocksTransitive: a.blocksTransitive,
      blocksCritical: critical(down),
    };
    if (a.effective === "awaiting_approval" && a.blocksDirect > 0) {
      out.push({ ...base, actor: { type: "pm" }, reason: "awaiting_approval" });
    } else if (t.status === "blocked_manual") {
      out.push({ ...base, actor: { type: "pm" }, reason: "manual" });
    } else if ((a.effective === "ready" || a.effective === "in_progress") && a.blocksTransitive > 0) {
      const overdue = !!t.plannedEnd && t.plannedEnd < today;
      if (overdue) out.push({ ...base, actor: { type: "contractor", id: t.contractorId ?? null }, reason: "overdue" });
      else if (a.blocksTransitive >= 3)
        out.push({ ...base, actor: { type: "contractor", id: t.contractorId ?? null }, reason: "bottleneck" });
    }
  }
  return out.sort(
    (a, b) =>
      b.blocksTransitive - a.blocksTransitive ||
      Number(b.blocksCritical) - Number(a.blocksCritical) ||
      a.title.localeCompare(b.title, "he"),
  );
}

// ───────────────────────── what-if: completion & release ─────────────────────────

/** Return a copy of the input with the given tasks marked done at `at`. */
export function withCompleted(input: EngineInput, taskIds: Iterable<string>, at: Date = input.now): EngineInput {
  const set = new Set(taskIds);
  return {
    ...input,
    tasks: input.tasks.map((t) => (set.has(t.id) ? { ...t, status: "done", completedAt: at.toISOString() } : t)),
  };
}

/**
 * Tasks that became ready between two analyses — the set to auto-release and
 * notify after a completion / approval / blocker resolution / lag expiry.
 */
export function newlyReady(before: ProjectAnalysis, after: ProjectAnalysis): string[] {
  return after.readyIds.filter((id) => before.byTask[id] && before.byTask[id].effective === "blocked");
}

/** Ready (and in-progress) tasks that a contractor can complete today. */
function actionableIds(a: ProjectAnalysis): string[] {
  return [...a.readyIds, ...a.inProgressIds].sort();
}

/**
 * Unlock impact for every actionable task: how many tasks become ready (now,
 * or after their lag) if it is completed today.
 */
export function unlockImpact(input: EngineInput, base: ProjectAnalysis = analyze(input)): UnlockImpact[] {
  const g = buildGraph(input);
  const nowMs = input.now.getTime();
  return actionableIds(base).map((id) => {
    const sim = buildGraph(withCompleted(input, [id]));
    const { immediate, afterLag } = freedSuccessors(sim, g.outgoing.get(id) ?? [], nowMs);
    return { taskId: id, immediate, afterLag, downstream: base.byTask[id].blocksTransitive };
  });
}

/** Of the given candidate successors, which have no remaining blockers (except lag)? */
function freedSuccessors(g: Graph, edges: EngineDependency[], nowMs: number) {
  const immediate = new Set<string>();
  const afterLag = new Set<string>();
  for (const d of edges) {
    const s = g.tasks.get(d.toTaskId)!;
    if (s.status === "done" || s.status === "awaiting_approval" || s.status === "in_progress" || s.status === "blocked_manual")
      continue;
    const items = directBlockers(g, s, nowMs, new Map());
    if (items.length === 0) immediate.add(s.id);
    else if (items.every((i) => i.kind === "lag")) afterLag.add(s.id);
  }
  return { immediate: [...immediate].sort(), afterLag: [...afterLag].sort() };
}

export interface Recommendation {
  taskIds: string[];
  /** Tasks unlocked immediately by completing the whole set. */
  unlocked: string[];
  /** Unlocked but waiting on a lag (drying). */
  unlockedAfterLag: string[];
}

/**
 * "Complete these K tasks today to unlock N more." Greedy maximum-coverage on
 * the set simulation (so two predecessors of the same task count together),
 * tie-broken by critical path, downstream reach, then id.
 */
export function recommendToday(input: EngineInput, k = 3, base: ProjectAnalysis = analyze(input)): Recommendation {
  const nowMs = input.now.getTime();
  const g = buildGraph(input);
  const candidates = actionableIds(base);
  const chosen: string[] = [];
  let current = { immediate: [] as string[], afterLag: [] as string[] };

  const evaluate = (set: string[]) => {
    const sim = buildGraph(withCompleted(input, set));
    const edges = set.flatMap((id) => g.outgoing.get(id) ?? []);
    return freedSuccessors(sim, edges, nowMs);
  };
  const score = (r: { immediate: string[]; afterLag: string[] }) => r.immediate.length * 1000 + r.afterLag.length;

  for (let round = 0; round < k; round++) {
    let best: { id: string; res: typeof current; gain: number } | null = null;
    for (const id of candidates) {
      if (chosen.includes(id)) continue;
      const res = evaluate([...chosen, id]);
      const gain = score(res) - score(current);
      const better =
        !best ||
        gain > best.gain ||
        (gain === best.gain &&
          (Number(base.byTask[id].onCriticalPath) - Number(base.byTask[best.id].onCriticalPath) ||
            base.byTask[id].blocksTransitive - base.byTask[best.id].blocksTransitive ||
            best.id.localeCompare(id)) > 0);
      if (better) best = { id, res, gain };
    }
    if (!best || best.gain <= 0) {
      // Nothing unlocks more; still fill with the most critical / far-reaching work.
      if (!best) break;
      const fallback = candidates
        .filter((id) => !chosen.includes(id) && (base.byTask[id].onCriticalPath || base.byTask[id].blocksTransitive > 0))
        .sort(
          (a, b) =>
            Number(base.byTask[b].onCriticalPath) - Number(base.byTask[a].onCriticalPath) ||
            base.byTask[b].blocksTransitive - base.byTask[a].blocksTransitive ||
            a.localeCompare(b),
        )[0];
      if (!fallback) break;
      chosen.push(fallback);
      current = evaluate(chosen);
      continue;
    }
    chosen.push(best.id);
    current = best.res;
  }
  return { taskIds: chosen, unlocked: current.immediate, unlockedAfterLag: current.afterLag };
}

/**
 * What-if: how many hours the end of all remaining work moves if `taskId`
 * takes `delayHours` longer (exact — re-runs the CPM pass, lags included).
 */
export function delayImpact(input: EngineInput, taskId: string, delayHours: number, base: ProjectAnalysis = analyze(input)): number {
  const delayed = analyze({ ...input, tasks: input.tasks.map((t) => (t.id === taskId ? { ...t, delayHours: (t.delayHours ?? 0) + delayHours } : t)) });
  return Math.max(0, delayed.projectEndHours - base.projectEndHours);
}

/** Convenience: hours offset from `now` → Date. */
export function hoursFromNow(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * HOUR);
}
