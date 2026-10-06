import { describe, expect, it } from "vitest";
import {
  analyze,
  detectCycles,
  durationHours,
  newlyReady,
  recommendToday,
  unlockImpact,
  validateNewDependency,
  withCompleted,
  type EngineDependency,
  type EngineInput,
  type EngineTask,
} from "./index";

const NOW = new Date("2026-10-05T09:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function task(id: string, status: EngineTask["status"] = "planned", extra: Partial<EngineTask> = {}): EngineTask {
  return { id, title: id.toUpperCase(), status, contractorId: `c-${id}`, ...extra };
}
function dep(from: string, to: string, lagHours = 0): EngineDependency {
  return { id: `${from}->${to}`, fromTaskId: from, toTaskId: to, lagHours };
}
function input(tasks: EngineTask[], dependencies: EngineDependency[], extra: Partial<EngineInput> = {}): EngineInput {
  return { tasks, dependencies, blockers: [], now: NOW, ...extra };
}

describe("effective state", () => {
  it("a task with no predecessors is ready", () => {
    const a = analyze(input([task("a")], []));
    expect(a.byTask.a.effective).toBe("ready");
    expect(a.readyIds).toEqual(["a"]);
  });

  it("is blocked until every predecessor is done, listing exactly the blockers", () => {
    const a = analyze(
      input([task("e", "done", { completedAt: hoursAgo(5) }), task("p", "in_progress"), task("d")], [dep("e", "d"), dep("p", "d")]),
    );
    expect(a.byTask.d.effective).toBe("blocked");
    expect(a.byTask.d.blockedBy).toEqual([
      { kind: "task", taskId: "p", title: "P", state: "in_progress", contractorId: "c-p", needsPm: false },
    ]);
  });

  it("awaiting_approval does not count as done — the PM must act", () => {
    const a = analyze(input([task("x", "awaiting_approval"), task("y")], [dep("x", "y")]));
    expect(a.byTask.y.effective).toBe("blocked");
    expect(a.byTask.y.blockedBy[0]).toMatchObject({ kind: "task", needsPm: true, state: "awaiting_approval" });
  });

  it("respects lag (plaster drying before paint)", () => {
    const plaster = task("plaster", "done", { completedAt: hoursAgo(20) });
    const paint = task("paint");
    const a = analyze(input([plaster, paint], [dep("plaster", "paint", 72)]));
    expect(a.byTask.paint.effective).toBe("blocked");
    expect(a.byTask.paint.blockedBy).toEqual([
      { kind: "lag", taskId: "plaster", title: "PLASTER", until: new Date(NOW.getTime() + 52 * 3600_000).toISOString() },
    ]);
    const later = analyze(input([plaster, paint], [dep("plaster", "paint", 72)], { now: new Date(NOW.getTime() + 53 * 3600_000) }));
    expect(later.byTask.paint.effective).toBe("ready");
  });

  it("open external blockers block; resolved ones do not", () => {
    const deps: EngineDependency[] = [{ id: "b->t", fromBlockerId: "fire", toTaskId: "t" }];
    const open = analyze(input([task("t")], deps, { blockers: [{ id: "fire", title: "Fire approval", ownerName: "Roni", status: "open" }] }));
    expect(open.byTask.t.blockedBy).toEqual([{ kind: "external", blockerId: "fire", title: "Fire approval", ownerName: "Roni" }]);
    const resolved = analyze(input([task("t")], deps, { blockers: [{ id: "fire", title: "Fire approval", status: "resolved" }] }));
    expect(resolved.byTask.t.effective).toBe("ready");
  });

  it("manual block is reported with its reason", () => {
    const a = analyze(input([task("m", "blocked_manual", { blockedReason: "no pipes" })], []));
    expect(a.byTask.m.effective).toBe("blocked");
    expect(a.byTask.m.blockedBy).toEqual([{ kind: "manual", reason: "no pipes" }]);
  });

  it("flags in-progress work that started out of order", () => {
    const a = analyze(input([task("a"), task("b", "in_progress")], [dep("a", "b")]));
    expect(a.byTask.b.effective).toBe("in_progress");
    expect(a.byTask.b.outOfOrder).toBe(true);
  });

  it("stored 'ready' is recomputed — a new unfinished predecessor blocks it", () => {
    const a = analyze(input([task("a"), task("b", "ready")], [dep("a", "b")]));
    expect(a.byTask.b.effective).toBe("blocked");
  });

  it("ignores dangling edges", () => {
    const a = analyze(input([task("a")], [dep("ghost", "a"), dep("a", "ghost")]));
    expect(a.byTask.a.effective).toBe("ready");
  });
});

describe("root blockers (who must act)", () => {
  it("walks upstream through blocked tasks to the actionable item", () => {
    // fire approval → detection → doors → handover; plus manual block on pipes → drywall
    const tasks = [task("det"), task("doors"), task("handover"), task("pipes", "blocked_manual", { blockedReason: "supplier" })];
    const deps: EngineDependency[] = [
      { id: "x", fromBlockerId: "fire", toTaskId: "det" },
      dep("det", "doors"),
      dep("doors", "handover"),
      dep("pipes", "handover"),
    ];
    const a = analyze(input(tasks, deps, { blockers: [{ id: "fire", title: "Fire", ownerName: "Roni", status: "open" }] }));
    expect(a.byTask.handover.rootBlockers).toEqual([
      { kind: "manual", taskId: "pipes", title: "PIPES", reason: "supplier" },
      { kind: "external", blockerId: "fire", title: "Fire", ownerName: "Roni" },
    ]);
  });

  it("stops at the first actionable predecessor and names its contractor", () => {
    const a = analyze(input([task("a", "in_progress"), task("b"), task("c")], [dep("a", "b"), dep("b", "c")]));
    expect(a.byTask.c.rootBlockers).toEqual([
      { kind: "task", taskId: "a", title: "A", state: "in_progress", contractorId: "c-a", needsPm: false },
    ]);
  });
});

describe("cycles", () => {
  it("detects cycles", () => {
    const tasks = ["a", "b", "c", "d"].map((id) => task(id));
    expect(detectCycles(tasks, [dep("a", "b"), dep("b", "c"), dep("c", "a"), dep("c", "d")])).toEqual([["a", "b", "c"]]);
    expect(detectCycles(tasks, [dep("a", "b"), dep("b", "c")])).toEqual([]);
  });

  it("rejects a new edge that would close a cycle, returning the path", () => {
    const deps = [dep("a", "b"), dep("b", "c")];
    expect(validateNewDependency(deps, "c", "a")).toEqual({ ok: false, reason: "cycle", path: ["a", "b", "c"] });
    expect(validateNewDependency(deps, "a", "a")).toMatchObject({ ok: false, reason: "self" });
    expect(validateNewDependency(deps, "a", "b")).toEqual({ ok: false, reason: "duplicate" });
    expect(validateNewDependency(deps, "a", "c")).toEqual({ ok: true });
  });

  it("analysis survives cyclic data and marks the nodes", () => {
    const a = analyze(input([task("a"), task("b"), task("c")], [dep("a", "b"), dep("b", "a"), dep("b", "c")]));
    expect(a.cycles).toEqual([["a", "b"]]);
    expect(a.byTask.a.inCycle).toBe(true);
    expect(a.byTask.c.effective).toBe("blocked");
  });

  it("handles a 5,000-node chain without recursion limits", () => {
    const tasks = Array.from({ length: 5000 }, (_, i) => task(`t${String(i).padStart(5, "0")}`));
    const deps = tasks.slice(1).map((t, i) => dep(tasks[i].id, t.id));
    const a = analyze(input(tasks, deps));
    expect(a.cycles).toEqual([]);
    expect(a.byTask[tasks[0].id].blocksTransitive).toBe(4999);
  });
});

describe("blocking counts & critical path", () => {
  const tasks = [
    task("a", "planned", { plannedStart: "2026-10-05", plannedEnd: "2026-10-06" }), // 2 days
    task("b", "planned", { plannedStart: "2026-10-05", plannedEnd: "2026-10-09" }), // 5 days
    task("c", "planned", { plannedStart: "2026-10-05", plannedEnd: "2026-10-05" }), // 1 day
    task("d", "planned", { plannedStart: "2026-10-05", plannedEnd: "2026-10-05" }),
    task("e", "done", { completedAt: hoursAgo(1) }),
  ];
  const deps = [dep("a", "c"), dep("b", "c"), dep("c", "d"), dep("e", "a")];

  it("counts direct and transitive blocked tasks", () => {
    const a = analyze(input(tasks, deps));
    expect(a.byTask.a.blocksDirect).toBe(1);
    expect(a.byTask.a.blocksTransitive).toBe(2);
    expect(a.byTask.c.blocksTransitive).toBe(1);
    expect(a.byTask.e.blocksTransitive).toBe(0); // done blocks nothing
  });

  it("finds the longest remaining path as critical", () => {
    const a = analyze(input(tasks, deps));
    expect(a.criticalPath).toEqual(["b", "c", "d"]);
    expect(a.byTask.a.onCriticalPath).toBe(false);
    expect(a.byTask.a.slackHours).toBe(72);
    expect(a.projectEndHours).toBe(7 * 24);
  });

  it("includes lag in the path length", () => {
    const a = analyze(input(tasks, [...deps.filter((d) => d.id !== "a->c"), dep("a", "c", 100)]));
    expect(a.criticalPath).toEqual(["a", "c", "d"]);
  });

  it("remaining duration of in-progress work comes from its planned end", () => {
    expect(durationHours(task("x", "in_progress", { plannedEnd: "2026-10-06" }), NOW.getTime())).toBe(39);
    expect(durationHours(task("x", "in_progress", { plannedEnd: "2026-10-01" }), NOW.getTime())).toBe(8);
    expect(durationHours(task("x", "awaiting_approval"), NOW.getTime())).toBe(0);
  });
});

describe("release & unlock impact", () => {
  it("newlyReady lists exactly the successors released by a completion", () => {
    const base = input(
      [task("a", "awaiting_approval"), task("b"), task("c"), task("other"), task("x", "in_progress")],
      [dep("a", "b"), dep("a", "c"), dep("x", "c"), dep("b", "other")],
    );
    const before = analyze(base);
    const after = analyze(withCompleted(base, ["a"]));
    expect(newlyReady(before, after)).toEqual(["b"]); // c still waits for x
  });

  it("computes unlock impact per actionable task, separating lag waits", () => {
    const base = input(
      [task("pl"), task("pa"), task("d"), task("e"), task("f")],
      [dep("pl", "pa", 72), dep("d", "e"), dep("d", "f")],
    );
    const imp = Object.fromEntries(unlockImpact(base).map((i) => [i.taskId, i]));
    expect(imp.pl).toMatchObject({ immediate: [], afterLag: ["pa"] });
    expect(imp.d).toMatchObject({ immediate: ["e", "f"], afterLag: [] });
  });

  it("recommends the set that unlocks the most, counting joint predecessors", () => {
    // j needs both p1 and p2; s1 alone unlocks 1; big unlocks 3.
    const base = input(
      [task("big"), task("x1"), task("x2"), task("x3"), task("p1"), task("p2"), task("j"), task("s1"), task("y")],
      [dep("big", "x1"), dep("big", "x2"), dep("big", "x3"), dep("p1", "j"), dep("p2", "j"), dep("s1", "y")],
    );
    const rec = recommendToday(base, 3);
    expect(rec.taskIds[0]).toBe("big");
    expect(rec.unlocked).toEqual(expect.arrayContaining(["x1", "x2", "x3"]));
    expect(rec.unlocked.length).toBe(4);
    // With k=4 the pair p1+p2 becomes worthwhile.
    const rec4 = recommendToday(base, 4);
    expect(rec4.unlocked).toEqual(expect.arrayContaining(["x1", "x2", "x3", "y", "j"]));
  });

  it("is deterministic regardless of input order", () => {
    const tasks = [task("a"), task("b"), task("c"), task("d")];
    const deps = [dep("a", "c"), dep("b", "d")];
    const r1 = recommendToday(input(tasks, deps), 1);
    const r2 = recommendToday(input([...tasks].reverse(), [...deps].reverse()), 1);
    expect(r1).toEqual(r2);
    expect(r1.taskIds).toEqual(["a"]);
  });
});

describe("bottlenecks (blockers that need you)", () => {
  it("ranks external blockers, approvals and overdue work by what they hold up", () => {
    const tasks = [
      task("rw", "in_progress", { plannedEnd: "2026-10-01" }), // overdue
      task("p1"),
      task("p2"),
      task("rep", "awaiting_approval"),
      task("q"),
      task("f1"),
      task("f2"),
      task("f3"),
    ];
    const deps: EngineDependency[] = [
      dep("rw", "p1"),
      dep("rw", "p2"),
      dep("rep", "q"),
      { id: "x1", fromBlockerId: "fire", toTaskId: "f1" },
      { id: "x2", fromBlockerId: "fire", toTaskId: "f2" },
      dep("f2", "f3"),
    ];
    const a = analyze(input(tasks, deps, { blockers: [{ id: "fire", title: "Fire", ownerName: "Roni", status: "open" }] }));
    expect(a.bottlenecks.map((b) => [b.id, b.reason, b.blocksTransitive])).toEqual([
      ["fire", "external", 3],
      ["rw", "overdue", 2],
      ["rep", "awaiting_approval", 1],
    ]);
    expect(a.bottlenecks[1].actor).toEqual({ type: "contractor", id: "c-rw" });
  });
});

describe("project-timezone 'today'", () => {
  it("uses the provided local date for overdue, not the UTC date", () => {
    // 22:30 UTC on Oct 5 is already Oct 6 in Israel → a task due Oct 5 is overdue there
    const late = new Date("2026-10-05T22:30:00Z");
    const tasks = [task("x", "in_progress", { plannedEnd: "2026-10-05" }), task("y"), task("z"), task("w")];
    const deps = [dep("x", "y"), dep("y", "z"), dep("z", "w")];
    const utc = analyze(input(tasks, deps, { now: late }));
    expect(utc.bottlenecks.find((b) => b.id === "x")?.reason).toBe("bottleneck");
    const local = analyze(input(tasks, deps, { now: late, today: "2026-10-06" }));
    expect(local.bottlenecks.find((b) => b.id === "x")?.reason).toBe("overdue");
  });
});
