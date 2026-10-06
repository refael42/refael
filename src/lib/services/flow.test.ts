import { describe, expect, it } from "vitest";
import { sid } from "@/lib/seed/demo";
import { APARTMENT_FLOW, stagesFor, type FlowStage } from "@/lib/flow/process";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { createAreas } from "./settings";
import { applyFlow, flowStatus } from "./flow";
import { loadFlow, resetFlow, saveFlow } from "./flow-template";
import { loadSnapshot } from "./snapshot";

describe("apply the construction process to apartments", () => {
  it("creates every stage with the process dependencies, ready in the right order", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [floor] = await createAreas(pm, { parentId: sid("area:building"), type: "floor", names: ["קומה 5"] });
    const apts = await createAreas(pm, { parentId: floor.id, type: "apartment", names: ["דירה 21-22"] });
    const res = await applyFlow(pm, { areaIds: apts.map((a) => a.id), startDate: "2026-10-12", staggerDays: 3 });
    const plain = stagesFor(APARTMENT_FLOW, ["elevator", "parking"]); // the demo building's features
    const edges = plain.reduce((n, s) => n + s.after.filter((a) => !a.scope).length, 0);
    expect(res).toMatchObject({ created: plain.length * 2, linked: edges * 2, areas: 2 });

    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const st = flowStatus(snap, apts[0].id, APARTMENT_FLOW);
    expect(st.blocks.state).toBe("ready"); // first stage is open
    expect(st.plaster.state).toBe("blocked");
    expect(st.comm_finish.state).toBe("blocked");
    // communications finish waits (transitively) on flooring
    const comm = snap.analysis.byTask[st.comm_finish.taskId!];
    expect(comm.blockedBy.map((b) => (b.kind === "task" ? b.title : ""))).toEqual(expect.arrayContaining([`ריצוף – דירה 21`]));
    // second apartment is staggered by 3 days
    const t21 = snap.taskById.get(st.blocks.taskId!)!;
    const t22 = snap.taskById.get(flowStatus(snap, apts[1].id, APARTMENT_FLOW).blocks.taskId!)!;
    expect(t21.planned_start).toBe("2026-10-12");
    expect(t22.planned_start).toBe("2026-10-15");
    // the flood test wait is a 48h lag before tiling
    const lag = snap.dependencies.find((d) => d.from_task_id === st.flood_test.taskId && d.to_task_id === st.flooring.taskId);
    expect(Number(lag?.lag_hours)).toBe(48);

    // re-applying adds nothing
    const again = await applyFlow(pm, { areaIds: [apts[0].id], startDate: "2026-10-12" });
    expect(again).toMatchObject({ created: 0, linked: 0 });
    // new trades were created on demand
    expect(store.data.trades.some((t) => t.key === "communications")).toBe(true);
  });

  it("a subset of stages pulls in its prerequisites", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [apt] = await createAreas(pm, { parentId: sid("area:floor4"), type: "apartment", names: ["דירה 99"] });
    const res = await applyFlow(pm, { areaIds: [apt.id], startDate: "2026-10-12", stageKeys: ["plaster"] });
    // plaster needs frames, marking (via infra), all infra, pressure test, blocks
    expect(res.created).toBe(10);
  });

  it("only the PM can apply it", async () => {
    const shor = await ctxFor("shor");
    await expect(applyFlow(shor, { areaIds: [sid("area:apt1")], startDate: "2026-10-12" })).rejects.toThrow();
  });
});

describe("company process template", () => {
  it("falls back to the built-in process, saves a custom one and applies it", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const org = pm.s.project.organization_id;
    expect((await loadFlow(store, org)).custom).toBe(false);

    const flow: FlowStage[] = [
      { key: "a", name: "שלב א", phase: "shell", trade: "general", days: 2, after: [], description: "" },
      { key: "b", name: "שלב ב", phase: "finish", trade: "general", days: 1, after: [{ key: "a", lag: 24, why: "ייבוש" }], description: "" },
    ];
    await saveFlow(pm, flow);
    const loaded = await loadFlow(store, org);
    expect(loaded.custom).toBe(true);
    expect(loaded.stages.map((s) => s.key)).toEqual(["a", "b"]);

    const [apt] = await createAreas(pm, { parentId: sid("area:floor4"), type: "apartment", names: ["דירה 77"] });
    const res = await applyFlow(pm, { areaIds: [apt.id], startDate: "2026-10-12" });
    expect(res).toMatchObject({ created: 2, linked: 1 });
    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const st = flowStatus(snap, apt.id, loaded.stages);
    expect(st.a.state).toBe("ready");
    expect(st.b.state).toBe("blocked");

    await resetFlow(pm);
    expect((await loadFlow(store, org)).custom).toBe(false);
  });

  it("rejects a process with a cycle and blocks non-PMs", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const cyc: FlowStage[] = [
      { key: "a", name: "א", phase: "shell", trade: "general", days: 1, after: [{ key: "b" }], description: "" },
      { key: "b", name: "ב", phase: "shell", trade: "general", days: 1, after: [{ key: "a" }], description: "" },
    ];
    await expect(saveFlow(pm, cyc)).rejects.toThrow();
    const contractor = await ctxFor("shor", store);
    await expect(saveFlow(contractor, APARTMENT_FLOW)).rejects.toThrow();
  });
});
