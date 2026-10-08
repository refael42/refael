import { beforeEach, describe, expect, it } from "vitest";
import { contractorProfileId, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW, T } from "@/test/fixtures";
import type { WaClient } from "@/lib/whatsapp/client";
import { templateParam, validSignature, waNumber } from "@/lib/whatsapp/client";
import { createHmac } from "node:crypto";
import { sendMessage } from "./chat";
import { registerMessageRelay } from "./messaging";
import { handleWebhook, relayToWhatsapp, type WaInboundMessage } from "./whatsapp";

type Sent = { to: string; how: "text" | "template" | "media"; text: string };

function fakeClient(sent: Sent[]): WaClient {
  return {
    async sendText(to, text) {
      sent.push({ to, how: "text", text });
    },
    async sendTemplate(to, text) {
      sent.push({ to, how: "template", text });
    },
    async sendMedia(to, _type, url, caption) {
      sent.push({ to, how: "media", text: `${url} ${caption ?? ""}` });
    },
    async fetchMedia(id) {
      return { bytes: Buffer.from(id), mime: "image/jpeg" };
    },
  };
}

const YOSSI = "+972501110005";
let sent: Sent[] = [];
let client: WaClient;
// the relay reads the current fake client, so one registration serves every test
registerMessageRelay((store, msg) => relayToWhatsapp(store, msg, { client, mediaUrl: async (k) => `https://files/${k}`, now: NOW }));

beforeEach(() => {
  sent = [];
  client = fakeClient(sent);
});

function hook(...messages: WaInboundMessage[]) {
  return { entry: [{ changes: [{ value: { messages } }] }] };
}
let n = 0;
const text = (from: string, body: string): WaInboundMessage => ({ id: `wamid.${++n}`, from: from.slice(1), type: "text", text: { body } });
const image = (from: string, caption?: string): WaInboundMessage => ({ id: `wamid.${++n}`, from: from.slice(1), type: "image", image: { id: `media${n}`, caption } });

describe("whatsapp", () => {
  const deps = () => ({ client, saveMedia: async (projectId: string) => `media/${projectId}/wa-${++n}.jpg`, now: NOW });

  it("'done' + photo from WhatsApp becomes a completion report awaiting the PM", async () => {
    const store = demoStore();
    await handleWebhook(store, hook(text(YOSSI, "סיימתי חשמל בדירה 14")), deps());
    const conv = sid("conv:direct:yossi");
    const said = store.data.messages.find((m) => m.conversation_id === conv && m.text === "סיימתי חשמל בדירה 14")!;
    expect(said.meta?.via).toBe("whatsapp");
    expect(said.ai_status).toBe("suggested");
    // the photo request went back to his WhatsApp (window open: he just wrote)
    expect(sent.find((s) => s.to === YOSSI && s.how === "text")?.text).toContain("תמונה");

    await handleWebhook(store, hook(image(YOSSI, "הכל מוכן")), deps());
    expect((await store.byId("tasks", T("E14")))!.status).toBe("awaiting_approval");
    const report = store.data.completion_reports.find((r) => r.task_id === T("E14") && r.status === "pending")!;
    expect(report.note).toBe("הכל מוכן");

    // a second photo right after joins the same report
    await handleWebhook(store, hook(image(YOSSI)), deps());
    expect(store.data.completion_reports.find((r) => r.id === report.id)!.photo_urls).toHaveLength(2);
  });

  it("each delivery is handled once; unknown numbers and STOP get a reply", async () => {
    const store = demoStore();
    const m = text(YOSSI, "מתי מגיע החומר?");
    await handleWebhook(store, hook(m, m), deps());
    expect(store.data.messages.filter((x) => x.text === "מתי מגיע החומר?")).toHaveLength(1);

    await handleWebhook(store, hook(text("+972599999999", "שלום")), deps());
    expect(sent.at(-1)).toMatchObject({ to: "+972599999999", how: "text" });

    // the PM writing from WhatsApp is told to use the app; nothing enters a chat
    const before = store.data.messages.length;
    await handleWebhook(store, hook(text("+972500000001", "בדיקה")), deps());
    expect(sent.at(-1)).toMatchObject({ to: "+972500000001", how: "text" });
    expect(store.data.messages).toHaveLength(before);

    await handleWebhook(store, hook(text(YOSSI, "הסר")), deps());
    expect((await store.byId("profiles", contractorProfileId("yossi")))!.wa_opt_out).toBe(true);
    sent.length = 0;
    const pm = await ctxFor("pm", store);
    await sendMessage(pm, sid("conv:direct:yossi"), { text: "תעדכן" });
    expect(sent).toHaveLength(0);
  });

  it("the PM's message reaches the contractor: a template outside the 24h window, free text inside it", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    await sendMessage(pm, sid("conv:direct:yossi"), { text: "מחר ב-7 בדירה 14\nתביא סולם" });
    expect(sent).toEqual([{ to: YOSSI, how: "template", text: "רפאל כהן: מחר ב-7 בדירה 14\nתביא סולם" }]);

    await store.update("profiles", { id: contractorProfileId("yossi") }, { wa_last_inbound_at: NOW.toISOString() });
    await sendMessage(pm, sid("conv:direct:yossi"), { text: "מעולה" });
    expect(sent.at(-1)).toEqual({ to: YOSSI, how: "text", text: "רפאל כהן: מעולה" });
    // the contractor's own messages are not echoed back
    const yossi = await ctxFor("yossi", store);
    await sendMessage(yossi, sid("conv:direct:yossi"), { text: "סגור" });
    expect(sent).toHaveLength(2);
  });

  it("helpers: phone format, template text, webhook signature", () => {
    expect(waNumber("+972501110005")).toBe("972501110005");
    expect(waNumber("050-1110005")).toBe("972501110005");
    expect(templateParam("שורה 1\n\nשורה 2\tסוף     !")).toBe("שורה 1 · שורה 2 סוף   !");
    const body = '{"a":1}';
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(validSignature(body, sig, "s3cret")).toBe(true);
    expect(validSignature(body, sig, "other")).toBe(false);
    expect(validSignature(body, null, "s3cret")).toBe(false);
  });
});
