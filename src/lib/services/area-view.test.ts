import { describe, expect, it } from "vitest";
import { mentionsArea } from "./area-view";

describe("mentionsArea", () => {
  it("matches names with Hebrew prefixes but not longer numbers", () => {
    expect(mentionsArea("קורת בטון מעל המשקוף בדירה 17, מתחילים", "דירה 17")).toBe(true);
    expect(mentionsArea("דירה 17", "דירה 17")).toBe(true);
    expect(mentionsArea("בדירה 17", "דירה 1")).toBe(false);
    expect(mentionsArea("סיימתי בקומה 2", "קומה 2")).toBe(true);
    expect(mentionsArea("קומה 22", "קומה 2")).toBe(false);
  });
});

describe("what prevents finishing an area", () => {
  it("groups the open work by who has to act and lists what the chats said", async () => {
    const { ctxFor, NOW } = await import("@/test/fixtures");
    const { loadSnapshot } = await import("./snapshot");
    const { areaEvents, whatPrevents } = await import("./area-view");
    const ctx = await ctxFor("pm");
    const apt = ctx.store.data.areas.find((a) => a.name === "דירה 17")!;
    const snap = await loadSnapshot(ctx.store, ctx.s.project.id, NOW);
    const w = whatPrevents(snap, apt.id);
    expect(w.open).toBeGreaterThan(0);
    expect(w.open).toBeLessThanOrEqual(w.total);
    expect(w.blocked.length).toBeGreaterThan(0);
    const listed = w.toInspect.length + w.toStart.length + w.inProgress.length;
    expect(listed).toBeLessThanOrEqual(w.open);

    await ctx.store.insert("project_events", {
      project_id: ctx.s.project.id,
      source_item_id: null,
      type: "new_task",
      summary: "משימה חדשה – דירה 17",
      quote: "לתקן את המשקוף בדירה 17",
      extracted: {},
      resolved: { task_ids: [], area_ids: [apt.id] },
      confidence: 0.8,
      status: "applied",
      note: null,
      occurred_at: NOW.toISOString(),
    });
    const other = ctx.store.data.areas.find((a) => a.name === "דירה 9")!;
    expect(await areaEvents(ctx.store, snap, other.id)).toEqual([]);
    const [e] = await areaEvents(ctx.store, snap, apt.id);
    expect(e).toMatchObject({ type: "new_task", status: "applied", quote: "לתקן את המשקוף בדירה 17" });
  });
});
