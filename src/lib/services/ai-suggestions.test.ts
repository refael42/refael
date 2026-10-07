import { describe, expect, it } from "vitest";
import { heuristicParse } from "@/lib/ai/heuristic";
import { contractorId, contractorProfileId, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW, T } from "@/test/fixtures";
import { analyzeMessage, approveSuggestion, buildParseContext, dismissSuggestion } from "./ai-suggestions";
import { sendMessage } from "./chat";
import { analyzeProject } from "./snapshot";

const direct = (k: string) => sid(`conv:direct:${k}`);
const group = sid("conv:group");

async function parseAs(who: "pm" | string, conv: string, text: string) {
  const store = demoStore();
  const ctx = await ctxFor(who, store);
  const msg = await sendMessage(ctx, conv, { text });
  const pctx = await buildParseContext(store, msg, NOW);
  return { parsed: heuristicParse(text, pctx), store, msg, ctx };
}

describe("local Hebrew parser", () => {
  it("splits a two-step instruction into a chain (Shor → Vadim)", async () => {
    const { parsed } = await parseAs("pm", direct("shor"), "שור, צריך לסמן את החורים בחיפוי של המרפסות ואז להזמין את ואדים");
    expect(parsed.intent).toBe("new_task");
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0]).toMatchObject({ contractor: "שור", depends_on_index: null });
    expect(parsed.tasks[0].title).toContain("סימון החורים");
    expect(parsed.tasks[1]).toMatchObject({ contractor: "ואדים", trade: "חיפוי חוץ", depends_on_index: 0 });
    expect(parsed.affects).toContain("התקנת מעקות מרפסות");
  });

  it("reads a structure task starting today with a 2-day check that affects plaster", async () => {
    const { parsed } = await parseAs("ahmad", direct("ahmad"), "צריך לצקת קורת בטון מעל המשקוף בדירה 17, מתחילים היום. ייבוש יומיים ואז אפשר לטייח");
    expect(parsed.intent).toBe("new_task");
    expect(parsed.tasks).toEqual([
      expect.objectContaining({ title: "יציקת קורת בטון מעל המשקוף – דירה 17", contractor: "אחמד", trade: "שלד", status: "in_progress", check_in_days: 2 }),
    ]);
    expect(parsed.affects).toEqual(["טיח פנים – דירה 17"]);
  });

  it("detects completion reports, blockers and questions", async () => {
    expect((await parseAs("yossi", group, "סיימתי חשמל בדירה 14")).parsed).toMatchObject({ intent: "completion_report", completes_task_id: T("E14") });
    const b = (await parseAs("samer", group, "אי אפשר להתחיל טיח בדירה 7, אין חשמל זמני בקומה 2")).parsed;
    expect(b).toMatchObject({ intent: "blocker", blocker_text: "אין חשמל זמני בקומה 2", affects: ["טיח פנים – דירה 7"] });
    expect((await parseAs("paz", group, "מתי מגיע יועץ הבטיחות לאשר? אני צריך לתכנן צוות")).parsed.intent).toBe("question");
    expect((await parseAs("ahmad", direct("ahmad"), "בסדר, אשלח מחר")).parsed.intent).toBe("none");
  });
});

describe("suggestion → approval flow", () => {
  it("never changes the graph until the PM approves (acceptance #3 + #4)", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const before = { tasks: store.data.tasks.length, deps: store.data.dependencies.length, blockers: store.data.external_blockers.length };
    const msg = await sendMessage(pm, direct("shor"), { text: "שור, צריך לסמן את החורים בחיפוי של המרפסות ואז להזמין את ואדים" });
    const ai = await analyzeMessage(store, msg.id, { now: NOW });
    expect(ai?.intent).toBe("new_task");
    expect(ai?.resolved?.tasks.map((t) => t.contractor_id)).toEqual([contractorId("shor"), contractorId("vadim")]);
    expect({ tasks: store.data.tasks.length, deps: store.data.dependencies.length, blockers: store.data.external_blockers.length }).toEqual(before);
    expect((await store.byId("messages", msg.id))!.ai_status).toBe("suggested");

    // a contractor cannot approve
    const shor = await ctxFor("shor", store);
    await expect(approveSuggestion(shor, msg.id)).rejects.toThrow();

    const res = await approveSuggestion(pm, msg.id);
    expect(res.createdTaskIds).toHaveLength(2);
    const [mark, clad] = res.createdTaskIds;
    const deps = store.data.dependencies.filter((d) => res.createdTaskIds.includes(d.from_task_id ?? ""));
    expect(deps.map((d) => [d.from_task_id, d.to_task_id])).toEqual(expect.arrayContaining([[mark, clad], [clad, T("RL")]]));
    const { analysis } = await analyzeProject(store, pm.s.project.id, NOW);
    expect(analysis.byTask[clad].blockedBy[0]).toMatchObject({ kind: "task", taskId: mark });
    // cannot be applied twice
    await expect(approveSuggestion(pm, msg.id)).rejects.toThrow();
  });

  it("a contractor's 'done' asks him for a photo; PM approval completes and releases", async () => {
    const store = demoStore();
    const yossi = await ctxFor("yossi", store);
    const msg = await sendMessage(yossi, group, { text: "סיימתי חשמל בדירה 15" });
    await analyzeMessage(store, msg.id, { now: NOW });
    const ask = store.data.messages.find((m) => m.meta?.action === "request_photo" && m.meta.source_message_id === msg.id);
    expect(ask?.meta).toMatchObject({ task_id: T("E15"), for_profile_id: contractorProfileId("yossi") });
    expect((await store.byId("tasks", T("E15")))!.status).toBe("planned");
    const pm = await ctxFor("pm", store);
    await approveSuggestion(pm, msg.id);
    expect((await store.byId("tasks", T("E15")))!.status).toBe("done");
  });

  it("blocker approval creates an external blocker that holds the affected task", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const seeded = sid("msg:g-samer");
    await approveSuggestion(pm, seeded);
    const blocker = store.data.external_blockers.find((b) => b.created_from_message_id === seeded)!;
    expect(blocker.title).toBe("אין חשמל זמני בקומה 2");
    const { analysis } = await analyzeProject(store, pm.s.project.id, NOW);
    expect(analysis.byTask[T("PL7")].blockedBy).toEqual([expect.objectContaining({ kind: "external", blockerId: blocker.id })]);
  });

  it("dismiss leaves no trace in the graph", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const n = store.data.tasks.length;
    await dismissSuggestion(pm, sid("msg:ahmad-beam"));
    expect(store.data.tasks.length).toBe(n);
    expect((await store.byId("messages", sid("msg:ahmad-beam")))!.ai_status).toBe("dismissed");
  });
});

describe("parser edge cases", () => {
  it("recognises short area names and does not fan out affects without an area", async () => {
    const { parsed } = await parseAs("pm", direct("shor"), "שור, צריך להתקין מעקה זמני בגג ואז להזמין את דני");
    expect(parsed.tasks[0]).toMatchObject({ area: "גג", contractor: "שור" });
    expect(parsed.tasks[1]).toMatchObject({ contractor: "דני", depends_on_index: 0 });
    const { parsed: noArea } = await parseAs("pm", direct("dani"), "דני, צריך לאטום את הפתחים");
    expect(noArea.affects).toEqual([]);
  });
});
