import { describe, expect, it } from "vitest";
import { detectCycles } from "../engine";
import { APARTMENT_FLOW, opensOf, stageLevels, stageSchedule } from "./process";

describe("master construction process", () => {
  it("is a valid acyclic graph with known references", () => {
    const keys = new Set(APARTMENT_FLOW.map((s) => s.key));
    expect(keys.size).toBe(APARTMENT_FLOW.length);
    for (const s of APARTMENT_FLOW) for (const a of s.after) expect(keys.has(a.key)).toBe(true);
    const deps = APARTMENT_FLOW.flatMap((s) => s.after.map((a) => ({ id: `${a.key}->${s.key}`, fromTaskId: a.key, toTaskId: s.key })));
    expect(detectCycles(APARTMENT_FLOW.map((s) => ({ id: s.key })), deps)).toEqual([]);
  });

  it("encodes the key ordering rules", () => {
    const lv = stageLevels();
    const before = (a: string, b: string) => expect(lv.get(a)!).toBeLessThan(lv.get(b)!);
    before("pressure_test", "plaster"); // test before closing walls
    before("plaster", "waterproofing");
    before("flood_test", "flooring");
    before("flooring", "comm_finish"); // communications only after tiling
    before("flooring", "plumb_finish"); // sanitary fixtures only after tiling
    before("paint_base", "paint_final");
    before("paint_final", "handover");
    expect(opensOf("flooring").map((s) => s.key)).toEqual(expect.arrayContaining(["drywall", "kitchen", "doors", "comm_finish", "plumb_finish"]));
  });

  it("schedules waiting times (drying, flood test) into the plan", () => {
    const sch = stageSchedule();
    expect(sch.get("waterproofing")!.start).toBeGreaterThanOrEqual(sch.get("plaster")!.end + 2);
    expect(sch.get("flooring")!.start).toBeGreaterThanOrEqual(sch.get("flood_test")!.end + 2);
    expect(Math.max(...[...sch.values()].map((v) => v.end))).toBeGreaterThan(30);
  });
});
