import { describe, expect, it } from "vitest";
import { MemoryStore } from "../db/memory-store";
import { loadSnapshot, snapshotRecommendation } from "../services/snapshot";
import { buildDemoData, DEMO_IDS, sid } from "./demo";

const NOW = new Date("2026-10-05T09:00:00Z");

describe("demo seed", () => {
  const data = buildDemoData(NOW);

  it("has the promised shape", () => {
    expect(data.areas.filter((a) => a.type === "floor")).toHaveLength(4);
    expect(data.areas.filter((a) => a.type === "apartment")).toHaveLength(20);
    expect(data.tasks.length).toBeGreaterThanOrEqual(120);
    expect(data.tasks.length).toBeLessThanOrEqual(140);
    expect(data.contractors.map((c) => c.name)).toEqual(expect.arrayContaining(["שור", "ואדים", "פז", "אחמד"]));
    expect(data.external_blockers.filter((b) => b.status === "open")).toHaveLength(2);
  });

  it("is deterministic and referentially sound", () => {
    expect(buildDemoData(NOW)).toEqual(data);
    const taskIds = new Set(data.tasks.map((t) => t.id));
    for (const d of data.dependencies) {
      expect(taskIds.has(d.to_task_id)).toBe(true);
      if (d.from_task_id) expect(taskIds.has(d.from_task_id)).toBe(true);
    }
    const ids = [...data.tasks, ...data.dependencies, ...data.messages].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a live, varied project for the engine", async () => {
    const snap = await loadSnapshot(new MemoryStore(data), DEMO_IDS.project, NOW);
    const a = snap.analysis;
    expect(a.cycles).toEqual([]);
    expect(a.readyIds.length).toBeGreaterThan(5);
    expect(a.blockedIds.length).toBeGreaterThan(40);
    expect(a.inProgressIds.length).toBeGreaterThan(5);
    expect(a.awaitingIds).toEqual([sid("task:D9")]);
    expect(a.criticalPath.length).toBeGreaterThan(2);

    const byId = Object.fromEntries(a.bottlenecks.map((b) => [b.id, b]));
    expect(byId[sid("blocker:fire")].blocksDirect).toBe(7);
    expect(byId[sid("task:RW")]).toMatchObject({ blocksDirect: 5, reason: "overdue" }); // 4 plaster + scaffolding
    // paint after plaster waits for drying in apt 4
    expect(a.byTask[sid("task:PA4")].blockedBy[0].kind).toBe("lag");

    const rec = snapshotRecommendation(snap, 3);
    expect(rec.taskIds).toHaveLength(3);
    expect(rec.unlocked.length + rec.unlockedAfterLag.length).toBeGreaterThan(3);
  });
});
