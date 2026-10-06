import { describe, expect, it } from "vitest";
import { contractorProfileId, DEMO_IDS, sid } from "@/lib/seed/demo";
import { demoStore, NOW, T } from "@/test/fixtures";
import { runTick } from "./reminders";

const H = 3600_000;

describe("reminders tick", () => {
  it("creates check / overdue / no-response reminders once", async () => {
    const store = demoStore();
    const first = await runTick(store, NOW);
    expect(first.reminders).toBeGreaterThan(3);
    const kinds = (k: string) => store.data.reminders.filter((r) => r.kind === k);
    expect(kinds("check").map((r) => r.task_id)).toEqual(expect.arrayContaining([T("H3"), T("ST4")]));
    expect(kinds("overdue").map((r) => r.task_id)).toEqual(expect.arrayContaining([T("RW"), T("H3")]));
    expect(kinds("no_response").map((r) => r.message_id)).toEqual([sid("msg:moti-1")]);

    const check = store.data.notifications.find((n) => n.kind === "check" && n.link === `/tasks/${T("H3")}`)!;
    expect(check.profile_id).toBe(DEMO_IDS.pm);
    expect(check.body).toContain("צנרת מיזוג VRF – קומה 3");
    expect(check.action).toMatchObject({ type: "send_follow_up", conversation_id: sid("conv:direct:paz") });

    const again = await runTick(store, new Date(NOW.getTime() + 60_000));
    expect(again.reminders).toBe(0);
  });

  it("releases a task when its drying time elapses and tells the contractor", async () => {
    const store = demoStore();
    // plaster apt 4 finished 20h before NOW; paint needs 72h → ready at NOW+52h
    const res = await runTick(store, new Date(NOW.getTime() + 52 * H + 5 * 60_000));
    expect(res.released).toBeGreaterThanOrEqual(1);
    expect((await store.byId("tasks", T("PA4")))!.status).toBe("ready");
    expect(store.data.notifications.some((n) => n.profile_id === contractorProfileId("avi") && n.kind === "released")).toBe(true);
    const again = await runTick(store, new Date(NOW.getTime() + 52 * H + 6 * 60_000));
    expect(again.released).toBe(0);
  });

  it("escalates repeated misses as urgent", async () => {
    const store = demoStore();
    await runTick(store, NOW);
    expect(store.data.notifications.filter((n) => n.kind === "escalation")).toHaveLength(0);
    await runTick(store, new Date(NOW.getTime() + 24 * H));
    const esc = store.data.notifications.filter((n) => n.kind === "escalation");
    expect(esc.length).toBeGreaterThan(0);
    expect(esc.every((n) => n.urgent)).toBe(true);
  });
});
