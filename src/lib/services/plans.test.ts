import { describe, expect, it } from "vitest";
import { DEMO_IDS, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, T } from "@/test/fixtures";
import { addPin, createPlan, deletePin, deletePlan, planVersions, plansForArea, updatePlan } from "./plans";

describe("plans & pins", () => {
  it("PM uploads a plan and pins an area; contractors cannot", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const plan = await createPlan(pm, { title: "קומה 3", fileKey: `media/${DEMO_IDS.project}/x.pdf`, floorAreaId: sid("area:floor3") });
    const pin = await addPin(pm, { planId: plan.id, page: 1, x: 0.3, y: 0.4, areaId: sid("area:apt12") });
    expect(pin).toMatchObject({ x: 0.3, y: 0.4, area_id: sid("area:apt12") });
    await expect(addPin(pm, { planId: plan.id, page: 1, x: 1.4, y: 0.4, areaId: null })).rejects.toThrow();
    const shor = await ctxFor("shor", store);
    await expect(addPin(shor, { planId: plan.id, page: 1, x: 0.1, y: 0.1, areaId: null })).rejects.toThrow();
    await expect(createPlan(pm, { title: "x", fileKey: "media/other/x.pdf" })).rejects.toThrow();
  });

  it("deleting a pin unlinks tasks that pointed at it", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    await deletePin(pm, sid("pin:apt17"));
    expect((await store.byId("tasks", T("PL17")))!.plan_pin_id).toBeNull();
  });

  it("reads the PDF text, keeps versions, carries pins over and shows plans on their areas", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const key = (n: string) => `media/${DEMO_IDS.project}/${n}.pdf`;
    const v1 = await createPlan(pm, { title: "חשמל קומה 3", fileKey: key("e1"), text: "תוכנית חשמל\nדירה 12\nגיליון E-103 מהדורה א", pageCount: 1 });
    expect(v1).toMatchObject({ discipline: "electrical", sheet: "E-103", revision: "א", version: 1, is_current: true });
    expect(v1.area_ids).toContain(sid("area:apt12"));
    await addPin(pm, { planId: v1.id, page: 1, x: 0.2, y: 0.2, areaId: sid("area:apt12") });

    const v2 = await createPlan(pm, { title: "", fileKey: key("e2"), text: "תוכנית חשמל\nדירה 12\nגיליון E-103 מהדורה ב", supersedesId: v1.id, changeNote: "הוזז לוח" });
    expect(v2).toMatchObject({ title: "חשמל קומה 3", version: 2, revision: "ב", supersedes_id: v1.id, change_note: "הוזז לוח" });
    expect((await store.byId("plan_files", v1.id))!.is_current).toBe(false);
    expect(store.data.plan_pins.filter((p) => p.plan_file_id === v2.id)).toHaveLength(1);
    expect((await planVersions(pm, v1.id)).map((p) => p.version)).toEqual([2, 1]);

    // the apartment sees the current version only
    const forApt = await plansForArea(pm, sid("area:apt12"));
    expect(forApt.map((p) => p.id)).toContain(v2.id);
    expect(forApt.map((p) => p.id)).not.toContain(v1.id);

    await updatePlan(pm, v2.id, { discipline: "plumbing", areaIds: [sid("area:apt12"), "not-an-area"] });
    expect(await store.byId("plan_files", v2.id)).toMatchObject({ discipline: "plumbing", area_ids: [sid("area:apt12")] });
    await expect(updatePlan(await ctxFor("shor", store), v2.id, { title: "x" })).rejects.toThrow();

    // removing the newest version brings the previous one back
    await deletePlan(pm, v2.id);
    expect((await store.byId("plan_files", v1.id))!.is_current).toBe(true);
  });
});
