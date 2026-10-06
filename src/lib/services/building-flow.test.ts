import { describe, expect, it } from "vitest";
import { APARTMENT_FLOW, BUILDING_FLOW } from "@/lib/flow/process";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { applyFlow, captureExisting, flowStatus, setFeatures } from "./flow";
import { saveFlow } from "./flow-template";
import { buildStructure } from "./project";
import { loadSnapshot } from "./snapshot";

async function newBuilding(features: string[], opts: { garden?: boolean; duplex?: boolean } = {}) {
  const store = demoStore();
  const pm = await ctxFor("pm", store);
  await buildStructure(store, pm.s.project.id, {
    buildingName: "בניין B",
    floorFrom: 0,
    floorTo: 2,
    aptsPerFloor: 2,
    firstApt: 1,
    buildingFeatures: features,
    gardenOnFirst: opts.garden,
    duplexOnTop: opts.duplex,
  });
  const building = store.data.areas.find((a) => a.type === "building" && a.name === "בניין B")!;
  const apts = store.data.areas.filter((a) => a.type === "apartment" && store.data.areas.find((f) => f.id === a.parent_id)?.parent_id === building.id);
  return { store, pm, building, apts };
}

describe("building shared-parts process", () => {
  it("creates the shared parts as areas and skips what the building doesn't have", async () => {
    const { store, pm, building } = await newBuilding([]);
    const res = await applyFlow(pm, { kind: "building", areaIds: [building.id], startDate: "2026-10-12" });
    const parts = store.data.areas.filter((a) => a.parent_id === building.id && a.type === "common").map((a) => a.features[0]);
    expect(parts).toEqual(expect.arrayContaining(["roof", "stairwell", "lobby", "site", "facade", "systems"]));
    expect(parts).not.toContain("parking");
    expect(parts).not.toContain("elevator");
    const skipped = BUILDING_FLOW.filter((s) => s.when).length;
    expect(res.created).toBe(BUILDING_FLOW.length - skipped);

    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const st = flowStatus(snap, building.id, BUILDING_FLOW);
    expect(st.parking_paint.state).toBe("skip");
    expect(st.roof_screed.state).toBe("ready");
    expect(st.roof_waterproofing.state).toBe("blocked");
    expect(st.site_paving.state).toBe("blocked");
    // the solar heaters task lives on the roof
    const heaters = snap.taskById.get(st.solar_heaters.taskId!)!;
    expect(snap.areaById.get(heaters.area_id!)!.name).toBe("גג");
  });

  it("links apartments to the building, whichever process is applied first", async () => {
    const { store, pm, building, apts } = await newBuilding(["sprinklers"], { garden: true });
    const garden = apts.find((a) => a.features.includes("garden"))!;
    // apartments first, then the building
    await applyFlow(pm, { areaIds: apts.map((a) => a.id), startDate: "2026-10-12" });
    await applyFlow(pm, { kind: "building", areaIds: [building.id], startDate: "2026-10-12" });
    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const apt = flowStatus(snap, garden.id, APARTMENT_FLOW);
    const b = flowStatus(snap, building.id, BUILDING_FLOW);
    const dep = (from: string, to: string) => snap.dependencies.some((d) => d.from_task_id === from && d.to_task_id === to);
    expect(apt.garden_paving.taskId).toBeTruthy();
    expect(dep(b.scaffold_removal.taskId!, apt.garden_paving.taskId!)).toBe(true); // garden paving after scaffolding comes down
    expect(dep(b.solar_heaters.taskId!, apt.hot_water.taskId!)).toBe(true); // hot water after the solar heaters
    expect(dep(b.sprinkler_risers.taskId!, apt.apt_sprinklers.taskId!)).toBe(true); // sprinkler building → apartment
    // an ordinary apartment has no garden stages
    const plain = apts.find((a) => !a.features.includes("garden"))!;
    expect(flowStatus(snap, plain.id, APARTMENT_FLOW).garden_paving.state).toBe("skip");
  });

  it("adds a duplex's stages when the apartment is marked later", async () => {
    const { store, pm, apts } = await newBuilding([]);
    const apt = apts[0];
    await applyFlow(pm, { areaIds: [apt.id], startDate: "2026-10-12" });
    const res = await setFeatures(pm, { areaIds: [apt.id], add: ["duplex", "parking"], remove: [] });
    expect(res.updated).toBe(1);
    expect(res.created).toBe(APARTMENT_FLOW.filter((s) => s.when === "duplex").length);
    expect(store.data.areas.find((a) => a.id === apt.id)!.features).toEqual(["duplex"]); // parking is a building feature
    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    expect(flowStatus(snap, apt.id, APARTMENT_FLOW).duplex_railing.taskId).toBeTruthy();
  });

  it("captures a building mid-way", async () => {
    const { store, pm, building } = await newBuilding(["elevator"]);
    const res = await captureExisting(pm, { kind: "building", areaIds: [building.id], doneUpTo: "roof_flood_test" });
    expect(res.marked).toBe(3); // screed, waterproofing, flood test
    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    expect(flowStatus(snap, building.id, BUILDING_FLOW).roof_protection.state).toBe("ready");
  });

  it("a custom building process must say which part each stage belongs to", async () => {
    const { pm } = await newBuilding([]);
    await expect(saveFlow(pm, [{ key: "x", name: "x", phase: "finish", trade: "general", days: 1, after: [], description: "" }], "building")).rejects.toThrow();
    await saveFlow(pm, [{ key: "x", name: "x", phase: "finish", trade: "general", days: 1, after: [], description: "", part: "roof" }], "building");
  });
});
