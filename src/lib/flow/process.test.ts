import { describe, expect, it } from "vitest";
import { detectCycles } from "../engine";
import { APARTMENT_FLOW, BUILDING_FLOW, opensOf, stageLevels, stageSchedule, stagesFor, validateFlow } from "./process";

describe("master construction process", () => {
  it("is a valid acyclic graph with known references", () => {
    for (const flow of [APARTMENT_FLOW, BUILDING_FLOW]) {
      expect(validateFlow(flow)).toEqual([]);
      const local = flow.flatMap((s) => s.after.filter((a) => !a.scope).map((a) => ({ id: `${a.key}->${s.key}`, fromTaskId: a.key, toTaskId: s.key })));
      expect(detectCycles(flow.map((s) => ({ id: s.key })), local)).toEqual([]);
    }
    // apartment ↔ building links point at real building stages, and keys never collide
    const bkeys = new Set(BUILDING_FLOW.map((s) => s.key));
    for (const s of APARTMENT_FLOW) for (const a of s.after) if (a.scope === "building") expect(bkeys.has(a.key)).toBe(true);
    for (const s of APARTMENT_FLOW) expect(bkeys.has(s.key)).toBe(false);
  });

  it("skips stages for features a place doesn't have and re-links around them", () => {
    const plain = stagesFor(APARTMENT_FLOW, []);
    expect(plain.some((s) => s.key === "garden_paving" || s.key === "apt_sprinklers" || s.key === "duplex_stairs")).toBe(false);
    expect(plain.find((s) => s.key === "plaster")!.after.map((a) => a.key)).not.toContain("apt_sprinklers");
    // handover still waits for hot water (always) — and not for garden stages
    expect(plain.find((s) => s.key === "handover")!.after.map((a) => a.key).sort()).toEqual(["cleaning", "hot_water"]);
    const garden = stagesFor(APARTMENT_FLOW, ["garden", "sprinklers"]);
    expect(garden.find((s) => s.key === "handover")!.after.map((a) => a.key)).toEqual(expect.arrayContaining(["garden_fence", "garden_planting"]));
    expect(garden.find((s) => s.key === "garden_paving")!.after).toEqual(expect.arrayContaining([expect.objectContaining({ key: "scaffold_removal", scope: "building" })]));
    // building without parking/elevator/sprinklers: form 4 waits for what exists
    const b = stagesFor(BUILDING_FLOW, []);
    const form4 = b.find((s) => s.key === "form4")!.after.map((a) => a.key);
    expect(form4).not.toContain("parking_paint");
    expect(form4).not.toContain("elevator_inspection");
    expect(form4).toContain("stair_electric"); // elevator inspection's own prerequisite bridged in
    expect(validateFlow(b)).toEqual([]);
    // parking without sprinklers: systems wait for risers only
    const p = stagesFor(BUILDING_FLOW, ["parking"]);
    expect(p.find((s) => s.key === "parking_systems")!.after.map((a) => a.key)).toEqual(["risers"]);
  });

  it("orders the building's shared parts", () => {
    const lv = stageLevels(BUILDING_FLOW);
    const before = (a: string, b: string) => expect(lv.get(a)!).toBeLessThan(lv.get(b)!);
    before("roof_waterproofing", "roof_flood_test");
    before("roof_protection", "solar_heaters");
    before("facade", "scaffold_removal");
    before("scaffold_removal", "site_infra");
    before("site_infra", "site_paving");
    before("lobby_floor", "entrance_door");
    before("elevator_install", "elevator_inspection");
    before("site_paving", "form4");
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
