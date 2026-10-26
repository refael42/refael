import { describe, expect, it } from "vitest";
import { DEMO_IDS } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW, T } from "@/test/fixtures";
import type { WaClient } from "@/lib/whatsapp/client";
import { applyEvent, autoApplied, listEvents, processSource, undoEvent } from "./intel";
import { runTick } from "./reminders";
import { handleWebhook, type WaInboundMessage } from "./whatsapp";

const PM = "972500000001";
let n = 0;

function setup() {
  const store = demoStore();
  const sent: string[] = [];
  const client: WaClient = {
    async sendText(_to, text) {
      sent.push(text);
    },
    async sendTemplate() {},
    async sendMedia() {},
    async fetchMedia() {
      return { bytes: Buffer.from(""), mime: "image/jpeg" };
    },
  };
  let at = Math.floor(NOW.getTime() / 1000);
  const say = async (body: string, forwarded = false) => {
    at += 60;
    const m: WaInboundMessage = { id: `wamid.act${++n}`, from: PM, timestamp: String(at), type: "text", text: { body }, ...(forwarded ? { context: { forwarded: true } } : {}) };
    await handleWebhook(store, { entry: [{ changes: [{ value: { messages: [m] } }] }] }, { client, saveMedia: async () => "media/x.jpg", now: NOW });
    return sent.at(-1)!;
  };
  return { store, say };
}

describe("the PM writes to the SiteFlow number → the app acts and says what it did", () => {
  it("his own 'X finished' closes the task; a forwarded one waits for inspection", async () => {
    const own = setup();
    const answer = await own.say("יוסי סיים חשמל בדירה 14");
    expect((await own.store.byId("tasks", T("E14")))!.status).toBe("done");
    expect(answer).toContain("✓ סומן כבוצע");
    expect(answer).toContain("דירה 14");
    // and he is told in the app too
    expect(own.store.data.notifications.some((x) => x.profile_id === DEMO_IDS.pm && x.kind === "wa_actions")).toBe(true);

    const fwd = setup();
    expect(await fwd.say("יוסי: סיימתי חשמל בדירה 14", true)).toContain("בוצע, לא נבדק");
    expect((await fwd.store.byId("tasks", T("E14")))!.status).toBe("awaiting_approval");
  });

  it("'remind me tomorrow at 8…' sets a check that fires even in setup mode", async () => {
    const { store, say } = setup();
    await store.update("projects", { id: DEMO_IDS.project }, { setup_mode: true });
    const answer = await say("תזכיר לי מחר ב-8 לבדוק חשמל בדירה 14");
    expect(answer).toContain("⏰");
    const task = (await store.byId("tasks", T("E14")))!;
    expect(task.check_at).toBe("2026-10-06T05:00:00.000Z");

    await runTick(store, new Date("2026-10-06T05:05:00Z"));
    expect(store.data.notifications.some((x) => x.kind === "check" && x.link === `/tasks/${T("E14")}`)).toBe(true);
  });

  it("a reminder with no matching task becomes a quiet task of its own", async () => {
    const { store, say } = setup();
    const before = store.data.tasks.length;
    await say("תזכורת ביום ראשון ב-10 להתקשר לאדריכל");
    const made = store.data.tasks.slice(before);
    expect(made).toHaveLength(1);
    expect(made[0].check_at).toBe("2026-10-11T07:00:00.000Z");
  });

  it("a new defect with a place becomes a task; vague messages wait for approval", async () => {
    const { store, say } = setup();
    const before = store.data.tasks.length;
    expect(await say("צריך להחליף משקוף בדירה 15")).toContain("➕");
    expect(store.data.tasks.length).toBe(before + 1);
    expect(await say("איך הולך?")).toContain("לא זיהיתי");
  });

  it("everything done by itself is listed and can be undone", async () => {
    const { store, say } = setup();
    const task = (await store.byId("tasks", T("E14")))!;
    await say("יוסי סיים חשמל בדירה 14");
    const pm = await ctxFor("pm", store);
    const done = await autoApplied(pm);
    expect(done).toHaveLength(1);
    expect(String(done[0].event.extracted.auto_line)).toContain("דירה 14");

    await undoEvent(pm, done[0].event.id);
    const back = (await store.byId("tasks", T("E14")))!;
    expect(back.status).toBe(task.status);
    expect(back.completed_at).toBe(task.completed_at);
    expect(store.data.completion_reports.filter((r) => r.task_id === T("E14") && r.created_at >= NOW.toISOString())).toHaveLength(0);
    expect(await autoApplied(pm)).toHaveLength(0);
    await expect(undoEvent(pm, done[0].event.id)).rejects.toThrow();
  });
});

describe("follow-ups in WhatsApp, and learning from the PM", () => {
  it("'בטל' takes back what the last message did", async () => {
    const { store, say } = setup();
    await say("יוסי סיים חשמל בדירה 14");
    expect((await store.byId("tasks", T("E14")))!.status).toBe("done");
    const answer = await say("בטל");
    expect(answer).toContain("ביטלתי");
    expect(answer).not.toContain("אפשר לבטל");
    expect((await store.byId("tasks", T("E14")))!.status).toBe("in_progress");
    expect(await say("בטל")).toContain("אין פעולה אחרונה");
  });

  it("'לא 15, 14' moves the update to the right apartment", async () => {
    const { store, say } = setup();
    await say("יוסי סיים חשמל בדירה 15");
    expect((await store.byId("tasks", T("E15")))!.status).toBe("done");
    const answer = await say("לא 15, 14");
    expect(answer).toContain("תיקנתי");
    expect(answer).toContain("דירה 14");
    expect((await store.byId("tasks", T("E15")))!.status).toBe("planned");
    expect((await store.byId("tasks", T("E14")))!.status).toBe("done");
    // and "טעות, דירה 16" again
    await say("טעות, דירה 16");
    expect((await store.byId("tasks", T("E14")))!.status).toBe("in_progress");
    expect(store.data.tasks.find((t) => t.title === "תשתיות חשמל – דירה 16")!.status).toBe("done");
  });

  it("a short answer fills in what the last message left out", async () => {
    const { store, say } = setup();
    // floor 3 has several tasks in progress: who finished?
    const first = await say("סיימו בקומה 3");
    expect(first).toContain("מחכים לאישורך");
    const answer = await say("דני");
    expect(answer).toContain("✓ סומן כבוצע");
    expect(store.data.tasks.find((t) => t.title === "איטום חדרים רטובים – קומה 3")!.status).toBe("done");
    // the unclear card is gone from the queue
    const pm = await ctxFor("pm", store);
    expect((await listEvents(pm)).some((c) => c.event.quote === "סיימו בקומה 3")).toBe(false);
  });

  it("after an undo, a similar message waits for approval; approving one like it ends that", async () => {
    const { store, say } = setup();
    await say("יוסי סיים חשמל בדירה 14");
    await say("בטל");
    expect(await say("יוסי סיים חשמל בדירה 15")).toContain("מחכים לאישורך");
    expect((await store.byId("tasks", T("E15")))!.status).toBe("planned");
    const pm = await ctxFor("pm", store);
    const card = (await listEvents(pm)).find((c) => c.event.quote === "יוסי סיים חשמל בדירה 15")!;
    pm.now = new Date(NOW.getTime() + 3600_000);
    await applyEvent(pm, card.event.id);
    expect(await say("יוסי סיים חשמל בדירה 16")).toContain("✓ סומן כבוצע");
  });

  it("an unclear message offers the tasks there; the PM's choice teaches which work such a message is about", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const [src] = await store.insert("sources", { project_id: pm.s.project.id, kind: "manual", title: "בדיקה", is_group: false, speakers: {}, created_by: pm.s.profile.id });
    const add = async (text: string, i: number) => {
      await store.insert("source_items", {
        project_id: pm.s.project.id, source_id: src.id, external_id: `x${i}`, sent_at: new Date(NOW.getTime() + i * 3 * 3600_000).toISOString(),
        author: "מישהו", author_profile_id: null, kind: "text", text, media_url: null, media_name: null, status: "new",
      });
      await processSource(pm, src.id);
      return (await listEvents(pm)).find((c) => c.event.quote === text)!;
    };
    const card = await add("הקבלן של החדרים הרטובים סיים בקומה 3", 1);
    expect(card.event.status).toBe("needs_info");
    expect(card.chosen).toEqual([]);
    const pick = card.tasks.find((t) => t.title === "איטום חדרים רטובים – קומה 3")!;
    expect(pick).toBeTruthy();
    await applyEvent(pm, card.event.id, { taskIds: [pick.id] });
    expect(store.data.tasks.find((t) => t.id === pick.id)!.status).toBe("awaiting_approval");

    // next time, the same words on another floor are about the same work
    const next = await add("הקבלן של החדרים הרטובים סיים בקומה 4", 2);
    expect(next.event.status).toBe("proposed");
    expect(next.tasks.map((t) => t.title)).toEqual(["איטום חדרים רטובים – קומה 4"]);
  });
});
