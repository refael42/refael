import { describe, expect, it } from "vitest";
import { DEMO_IDS } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW, T } from "@/test/fixtures";
import type { WaClient } from "@/lib/whatsapp/client";
import { autoApplied, undoEvent } from "./intel";
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
  const say = async (body: string, forwarded = false) => {
    const m: WaInboundMessage = { id: `wamid.act${++n}`, from: PM, type: "text", text: { body }, ...(forwarded ? { context: { forwarded: true } } : {}) };
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
