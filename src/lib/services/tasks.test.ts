import { describe, expect, it } from "vitest";
import { contractorId, contractorProfileId } from "@/lib/seed/demo";
import { ctxFor, T } from "@/test/fixtures";
import { analyzeProject } from "./snapshot";
import { addDependency, createTasks, setBlockerStatus, setTaskStatus, ServiceError } from "./tasks";
import { sid } from "@/lib/seed/demo";

describe("completion releases successors (acceptance #1)", () => {
  it("approving drywall apt 9 releases plaster apt 9 and messages Samer", async () => {
    const ctx = await ctxFor("pm");
    const res = await setTaskStatus(ctx, T("D9"), "done");
    expect(res.released).toEqual([T("PL9")]);
    const pl9 = await ctx.store.byId("tasks", T("PL9"));
    expect(pl9!.status).toBe("ready");
    const samer = contractorProfileId("samer");
    const notes = await ctx.store.select("notifications", { where: { profile_id: samer } });
    expect(notes.map((n) => n.kind)).toContain("released");
    const sys = ctx.store.data.messages.filter((m) => m.meta?.action === "task_released" && m.meta?.task_id === T("PL9"));
    expect(sys).toHaveLength(1);
    expect(sys[0].text).toContain("טיח פנים – דירה 9");
    const audits = ctx.store.data.audit_log.filter((a) => a.entity_id === T("PL9"));
    expect(audits.at(-1)).toMatchObject({ from_value: "planned", to_value: "ready", source: "system" });
  });

  it("does not release a successor that still waits on another predecessor", async () => {
    const ctx = await ctxFor("pm");
    // drywall 14 waits on E14, P14 and HVAC floor 3
    const res = await setTaskStatus(ctx, T("E14"), "done");
    expect(res.released).toEqual([]);
    const { analysis } = await analyzeProject(ctx.store, ctx.s.project.id, ctx.now);
    expect(analysis.byTask[T("D14")].blockedBy.map((b) => b.kind === "task" && b.taskId)).toEqual(
      expect.arrayContaining([T("P14"), T("H3")]),
    );
  });

  it("resolving an external blocker releases the tasks it held", async () => {
    const ctx = await ctxFor("pm");
    const res = await setBlockerStatus(ctx, sid("blocker:fire"), "resolved");
    expect(res.released.sort()).toEqual([T("FD1"), T("FD2"), T("FD3"), T("FD4"), T("FDOOR"), T("SHAFT"), T("SPR")].sort());
  });
});

describe("authorization", () => {
  it("a contractor cannot complete a task or touch someone else's", async () => {
    const ctx = await ctxFor("nikolai");
    await expect(setTaskStatus(ctx, T("D10"), "done")).rejects.toThrow();
    await expect(setTaskStatus(ctx, T("E15"), "in_progress")).rejects.toThrow();
    const ok = await setTaskStatus(ctx, T("D10"), "in_progress");
    expect(ok.task.status).toBe("in_progress");
  });

  it("viewers cannot create tasks", async () => {
    const ctx = await ctxFor("viewer");
    await expect(createTasks(ctx, [{ title: "x" }])).rejects.toThrow();
  });
});

describe("dependencies", () => {
  it("rejects a cycle with a Hebrew error", async () => {
    const ctx = await ctxFor("pm");
    await expect(addDependency(ctx, { fromTaskId: T("PA1"), toTaskId: T("E1") })).rejects.toBeInstanceOf(ServiceError);
    await expect(addDependency(ctx, { fromTaskId: T("PA1"), toTaskId: T("E1") })).rejects.toThrow("מעגל");
  });

  it("two sequential tasks from one instruction become a chain (acceptance #3)", async () => {
    const ctx = await ctxFor("pm");
    const res = await createTasks(
      ctx,
      [
        { title: "סימון חורים בחיפוי המרפסות", contractor_id: contractorId("shor"), area_id: sid("area:balconies"), trade_id: sid("trade:metalwork") },
        { title: "חיפוי מרפסות – קידוח והתקנה", contractor_id: contractorId("vadim"), area_id: sid("area:balconies"), trade_id: sid("trade:cladding") },
      ],
      { source: "ai", chain: [{ from: 0, to: 1 }], affects: [{ fromIndex: 1, toTaskId: T("RL") }] },
    );
    const [mark, clad] = res.tasks;
    expect(res.dependencies.map((d) => [d.from_task_id, d.to_task_id])).toEqual([
      [mark.id, clad.id],
      [clad.id, T("RL")],
    ]);
    const { analysis } = await analyzeProject(ctx.store, ctx.s.project.id, ctx.now);
    expect(analysis.byTask[mark.id].effective).toBe("ready");
    expect(analysis.byTask[clad.id].effective).toBe("blocked");

    // marking done → cladding released → Vadim gets the auto-message
    const done = await setTaskStatus(ctx, mark.id, "done");
    expect(done.released).toEqual([clad.id]);
    const vadimMsgs = ctx.store.data.messages.filter((m) => m.meta?.task_id === clad.id && m.meta?.action === "task_released");
    expect(vadimMsgs).toHaveLength(1);
  });
});
