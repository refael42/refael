import { describe, expect, it } from "vitest";
import { sid } from "@/lib/seed/demo";
import { ctxFor, NOW, T } from "@/test/fixtures";
import { askProject } from "./qa";
import { loadSnapshot } from "./snapshot";

async function ask(q: string) {
  const ctx = await ctxFor("pm");
  const snap = await loadSnapshot(ctx.store, ctx.s.project.id, NOW);
  return askProject(ctx.store, ctx.s, snap, q);
}
const ids = (a: Awaited<ReturnType<typeof ask>>) => a.sources.map((s) => s.id);

describe("ask the project (local engine)", () => {
  it("what prevents finishing apt 17 → open work by who acts, plus what the chats said, all cited", async () => {
    const ctx = await ctxFor("pm");
    const apt = ctx.store.data.areas.find((a) => a.name === "דירה 17")!;
    await ctx.store.insert("project_events", {
      project_id: ctx.s.project.id,
      source_item_id: null,
      type: "defect",
      summary: "ליקוי – דירה 17",
      quote: "יש סדק בריצוף בדירה 17",
      extracted: {},
      resolved: { task_ids: [], area_ids: [apt.id] },
      confidence: 0.8,
      status: "proposed",
      note: null,
      occurred_at: NOW.toISOString(),
    });
    const snap = await loadSnapshot(ctx.store, ctx.s.project.id, NOW);
    const a = await askProject(ctx.store, ctx.s, snap, "מה מונע כרגע את השלמת דירה 17?");
    expect(a.answer).toMatch(/^דירה 17: \d+ משימות פתוחות/);
    expect(a.answer).toContain("מה נאמר בשיחות:");
    expect(a.answer).toMatch(/יש סדק בריצוף בדירה 17.*\[U1\]/);
    expect(a.sources.some((x) => x.kind === "update")).toBe(true);
    expect(ids(a)).toEqual(expect.arrayContaining([T("PL17"), T("ST4")]));
  });

  it("what is holding up apt 17 → its tasks and the root causes", async () => {
    const a = await ask("מה תוקע כרגע את דירה 17?");
    expect(a.engine).toBe("local");
    expect(ids(a)).toEqual(expect.arrayContaining([T("PL17"), T("ST4"), T("RW")]));
    expect(a.answer).toMatch(/\[T\d+\]/);
  });

  it("what did I ask Ahmad this week → PM messages to Ahmad in the last 7 days", async () => {
    const a = await ask("מה ביקשתי מאחמד השבוע?");
    expect(ids(a)).toEqual(expect.arrayContaining([sid("msg:ahmad-1"), sid("msg:ahmad-3"), sid("msg:ahmad-4")]));
    expect(ids(a)).not.toContain(sid("msg:ahmad-2")); // Ahmad's own reply
  });

  it("what did I promise to check and didn't → overdue checks", async () => {
    const a = await ask("מה הבטחתי לבדוק ולא בדקתי?");
    expect(ids(a)).toEqual(expect.arrayContaining([T("H3"), T("ST4"), sid("msg:paz-1")]));
  });

  it("what must happen before I can invite Vadim → upstream of Vadim's work", async () => {
    const a = await ask("מה צריך לקרות לפני שאפשר להזמין את ואדים?");
    expect(ids(a)).toEqual(expect.arrayContaining([T("VC1")]));
    expect(a.sources.every((s) => s.href.startsWith("/"))).toBe(true);
  });
});
