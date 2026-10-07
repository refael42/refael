import { describe, expect, it } from "vitest";
import { DEMO_IDS, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, T } from "@/test/fixtures";
import { addPin, createPlan, deletePin } from "./plans";

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
});
