import { describe, expect, it } from "vitest";
import { APARTMENT_FLOW, stagesFor } from "@/lib/flow/process";
import { sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW, sessionFor } from "@/test/fixtures";
import { assignByTrade, captureExisting, flowStatus, toggleCaptured } from "./flow";
import { buildStructure, canCreateProject, createProject, setSetupMode } from "./project";
import { runTick } from "./reminders";
import { createAreas, importContractors, parseContractorLines } from "./settings";
import { loadSnapshot } from "./snapshot";

describe("new project", () => {
  it("opens a project in setup mode with its building structure", async () => {
    const store = demoStore();
    const s = await sessionFor(store, "pm");
    const p = await createProject(store, s, {
      name: "מגדלי הים – בניין B",
      startDate: "2026-01-01",
      structure: { buildingName: "בניין B", floorFrom: 0, floorTo: 3, aptsPerFloor: 4, firstApt: 1 },
    });
    expect(p.setup_mode).toBe(true);
    expect(p.organization_id).toBe(s.profile.organization_id);
    const areas = store.data.areas.filter((a) => a.project_id === p.id);
    expect(areas.filter((a) => a.type === "floor").map((a) => a.name)).toEqual(["קומת קרקע", "קומה 1", "קומה 2", "קומה 3"]);
    expect(areas.filter((a) => a.type === "apartment").map((a) => a.name).slice(-2)).toEqual(["דירה 15", "דירה 16"]);
    expect(store.data.project_members.some((m) => m.project_id === p.id && m.profile_id === s.profile.id && m.role === "pm")).toBe(true);
    // re-running adds nothing
    expect(await buildStructure(store, p.id, { buildingName: "בניין B", floorFrom: 0, floorTo: 3, aptsPerFloor: 4, firstApt: 1 })).toEqual({ floors: 0, apartments: 0 });
  });

  it("only PMs (or listed admins) may open projects", async () => {
    const store = demoStore();
    const contractor = { ...(await sessionFor(store, "shor")), isDemo: false };
    expect(canCreateProject(contractor)).toBe(false);
    expect(canCreateProject({ ...(await sessionFor(store, "pm")), isDemo: false })).toBe(true);
    await expect(createProject(store, contractor, { name: "x" })).rejects.toThrow();
  });
});

describe("setup mode and capturing an existing site", () => {
  it("captures apartments mid-way quietly and releases the next stage", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    await setSetupMode(pm, false);
    const [apt] = await createAreas(pm, { parentId: sid("area:floor4"), type: "apartment", names: ["דירה 90"] });
    const msgsBefore = store.data.messages.length;
    const res = await captureExisting(pm, { areaIds: [apt.id], doneUpTo: "plaster", rescheduleFrom: "2026-10-12" });
    expect(res.created).toBe(stagesFor(APARTMENT_FLOW, ["elevator", "parking"]).length);
    expect(res.marked).toBe(10); // plaster + everything it requires
    expect(store.data.messages.length).toBe(msgsBefore); // quiet: no assignment / release messages

    const snap = await loadSnapshot(store, pm.s.project.id, NOW);
    const st = flowStatus(snap, apt.id, APARTMENT_FLOW);
    expect(st.plaster.state).toBe("done");
    expect(st.blocks.state).toBe("done");
    expect(st.waterproofing.state).toBe("ready"); // opened by plaster, stored as ready
    expect(snap.taskById.get(st.waterproofing.taskId!)!.status).toBe("ready");
    // remaining stages re-dated from the given day
    const open = snap.tasks.filter((t) => t.area_id === apt.id && t.status !== "done");
    expect(open.map((t) => t.planned_start!).sort()[0]).toBe("2026-10-12");

    // one tap undoes a stage
    expect(await toggleCaptured(pm, st.plaster.taskId!)).toBe("planned");
    const snap2 = await loadSnapshot(store, pm.s.project.id, NOW);
    expect(flowStatus(snap2, apt.id, APARTMENT_FLOW).plaster.state).toBe("ready");
    expect(flowStatus(snap2, apt.id, APARTMENT_FLOW).waterproofing.state).toBe("blocked");
  });

  it("setup mode silences contractor messages and reminders", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    await setSetupMode(pm, true);
    pm.s.project.setup_mode = true;
    const before = { msgs: store.data.messages.length, notes: store.data.notifications.length };
    const tick = await runTick(store, NOW);
    expect(tick.reminders).toBe(0);
    expect(store.data.messages.length).toBe(before.msgs);
    expect(store.data.notifications.length).toBe(before.notes);
    await setSetupMode(pm, false);
    expect((await runTick(store, NOW)).reminders).toBeGreaterThan(0);
  });
});

describe("assign contractors by trade", () => {
  it("assigns every open process task of a trade and adds the contractor to the project", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [apt] = await createAreas(pm, { parentId: sid("area:floor4"), type: "apartment", names: ["דירה 91"] });
    await captureExisting(pm, { areaIds: [apt.id], doneUpTo: "blocks" });
    const plasterTrade = store.data.trades.find((t) => t.key === "plaster")!;
    const outsider = (await store.insert("contractors", { organization_id: pm.s.project.organization_id, profile_id: null, name: "טייח חדש", phone: null, trade_id: plasterTrade.id, company: null }))[0];
    const res = await assignByTrade(pm, { areaIds: [apt.id], byTrade: { [plasterTrade.id]: outsider.id } });
    expect(res.updated).toBeGreaterThan(0);
    const mine = store.data.tasks.filter((t) => t.area_id === apt.id && t.trade_id === plasterTrade.id);
    expect(mine.every((t) => t.contractor_id === outsider.id)).toBe(true);
    // a contractor of another company is refused
    await expect(assignByTrade(pm, { areaIds: null, byTrade: { [plasterTrade.id]: "00000000-0000-0000-0000-000000000000" } })).rejects.toThrow();
  });
});

describe("contractor import", () => {
  it("parses pasted lines in any order", () => {
    expect(parseContractorLines("ואדים, אלומיניום, 050-1234567\n  \nסאמר\tטיח\t052 765 4321\n0541112222 - יוסי - חשמל")).toEqual([
      { name: "ואדים", trade: "אלומיניום", phone: "+972501234567" },
      { name: "סאמר", trade: "טיח", phone: "+972527654321" },
      { name: "יוסי", trade: "חשמל", phone: "+972541112222" },
    ]);
  });

  it("adds new contractors, matches trades, and skips known ones", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const known = store.data.contractors[0];
    const res = await importContractors(pm, `חדש אחד, טיח, 050-9990001\nחדש שתיים, נגרות מטבחים, 050-9990002\n${known.name}, x, ${known.phone}\nבלי טלפון, טיח`);
    expect(res).toEqual({ added: 2, existing: 1, failed: ["בלי טלפון"] });
    const added = store.data.contractors.find((c) => c.name === "חדש אחד")!;
    expect(store.data.trades.find((t) => t.id === added.trade_id)?.name).toContain("טיח");
    expect(store.data.trades.some((t) => t.name === "נגרות מטבחים")).toBe(true);
  });
});
