import { describe, expect, it } from "vitest";
import { contractorProfileId, DEMO_IDS } from "@/lib/seed/demo";
import { ctxFor, demoStore, NOW } from "@/test/fixtures";
import { applyEvent } from "./intel";
import { connectWhatsapp, myWhatsapp, setWhatsappContact } from "./wa-link";
import { handleMirror, splitMirror } from "./wa-mirror";
import type { WaWebhook } from "./whatsapp";

const PID = "1111111111";
const OWN = "972557242018";
const ts = (h: number) => String(Math.floor(NOW.getTime() / 1000) - h * 3600);

function delivery(changes: Array<{ field: string; value: Record<string, unknown> }>, pid = PID): WaWebhook {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: changes.map((c) => ({ field: c.field, value: { messaging_product: "whatsapp", metadata: { phone_number_id: pid, display_phone_number: OWN }, ...c.value } })) }],
  };
}

async function setup() {
  const store = demoStore();
  const pm = await ctxFor("pm", store);
  await store.insert("whatsapp_links", { profile_id: DEMO_IDS.pm, waba_id: "222222", phone_number_id: PID, display_phone: OWN });
  const yossi = (await store.byId("profiles", contractorProfileId("yossi")))!;
  return { store, pm, yossiWa: yossi.phone!.replace(/\D/g, "") };
}

async function run(store: ReturnType<typeof demoStore>, payload: WaWebhook) {
  const { batches, rest } = splitMirror(payload, new Set([PID]));
  for (const b of batches) await handleMirror(store, b, NOW);
  return rest;
}

describe("the PM's own WhatsApp, mirrored", () => {
  it("keeps chats with project people (both sides) and reads them into updates; strangers are only counted", async () => {
    const { store, yossiWa } = await setup();
    await run(
      store,
      delivery([
        { field: "messages", value: { contacts: [{ wa_id: yossiWa, profile: { name: "יוסי" } }], messages: [{ id: "wamid.1", from: yossiWa, timestamp: ts(3), type: "text", text: { body: "סיימתי חשמל בדירה 14" } }] } },
        { field: "smb_message_echoes", value: { message_echoes: [{ id: "wamid.2", from: OWN, to: yossiWa, timestamp: ts(2), type: "text", text: { body: "מעולה, אני בודק מחר" } }] } },
        { field: "messages", value: { messages: [{ id: "wamid.3", from: "972501234999", timestamp: ts(1), type: "text", text: { body: "אמא: מה שלומך?" } }] } },
      ]),
    );
    const items = store.data.source_items.filter((i) => ["wamid.1", "wamid.2", "wamid.3"].includes(i.external_id));
    expect(items.map((i) => [i.external_id, i.author])).toEqual([
      ["wamid.1", "יוסי"],
      ["wamid.2", "רפאל כהן"],
    ]);
    expect(store.data.sources.find((s) => s.kind === "whatsapp_coexistence")!.title).toContain("יוסי");
    // read at once into an update waiting for the PM
    expect(items.every((i) => i.status === "processed")).toBe(true);
    expect(store.data.project_events.some((e) => e.source_item_id === items[0].id && e.type === "reported_done")).toBe(true);
    // the stranger: counted, nothing of what was said is stored
    const stranger = store.data.whatsapp_link_contacts.find((c) => c.wa_id === "972501234999")!;
    expect(stranger).toMatchObject({ status: "pending", message_count: 1 });
    expect(JSON.stringify(store.data.source_items)).not.toContain("אמא");
    // the same delivery again keeps nothing twice
    await run(store, delivery([{ field: "messages", value: { messages: [{ id: "wamid.1", from: yossiWa, timestamp: ts(3), type: "text", text: { body: "סיימתי חשמל בדירה 14" } }] } }]));
    expect(store.data.source_items.filter((i) => i.external_id === "wamid.1")).toHaveLength(1);
  });

  it("leaves the SiteFlow number's own messages to the old handler, and drops statuses", () => {
    const other = delivery([{ field: "messages", value: { messages: [{ id: "x", from: "972500000000", type: "text", text: { body: "סיימתי" } }] } }], "999");
    const mine = delivery([{ field: "messages", value: { statuses: [{ id: "s1", status: "read" }] } }]);
    const { batches, rest } = splitMirror({ entry: [...other.entry!, ...mine.entry!] }, new Set([PID]));
    expect(rest.entry).toHaveLength(1);
    expect(rest.entry![0].changes![0].value!.metadata!.phone_number_id).toBe("999");
    expect(batches[0].messages).toEqual([]);
  });

  it("follow keeps a stranger's next messages in the current project; ignore / stop never keeps, and can delete", async () => {
    const { store, pm } = await setup();
    const msg = (id: string, body: string) => delivery([{ field: "messages", value: { messages: [{ id, from: "972501234888", timestamp: ts(1), type: "text", text: { body } }] } }]);
    await run(store, msg("w1", "שלום, אני הקבלן החדש לאיטום"));
    const overview = await myWhatsapp(pm);
    expect(overview.pending.map((c) => c.wa_id)).toEqual(["972501234888"]);
    await setWhatsappContact(pm, overview.pending[0].id, "follow");
    await run(store, msg("w2", "אגיע מחר לדירה 15"));
    expect(store.data.source_items.map((i) => i.external_id)).toContain("w2");
    expect(store.data.source_items.map((i) => i.external_id)).not.toContain("w1");

    await setWhatsappContact(pm, overview.pending[0].id, "ignore", { deleteKept: true });
    await run(store, msg("w3", "עוד הודעה"));
    expect(store.data.source_items.map((i) => i.external_id)).not.toContain("w2");
    expect(store.data.source_items.map((i) => i.external_id)).not.toContain("w3");
    expect((await myWhatsapp(pm)).ignored).toHaveLength(1);
    // only the number's owner manages it
    await expect(setWhatsappContact(await ctxFor("shor", store), overview.pending[0].id, "follow")).rejects.toThrow();
  });

  it("reads the history delivered once at connection, both sides of each chat", async () => {
    const { store, yossiWa } = await setup();
    await run(
      store,
      delivery([
        {
          field: "history",
          value: {
            history: [
              {
                metadata: { phase: 0, chunk_order: 1, progress: 100 },
                threads: [
                  {
                    id: yossiWa,
                    messages: [
                      { id: "h1", from: yossiWa, timestamp: ts(200), type: "text", text: { body: "חסר חומר לקומה 3" } },
                      { id: "h2", from: OWN, to: yossiWa, timestamp: ts(199), type: "text", text: { body: "אני מזמין היום" } },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ]),
    );
    const items = store.data.source_items.filter((i) => i.external_id.startsWith("h"));
    expect(items.map((i) => [i.external_id, i.author_profile_id])).toEqual([
      ["h1", contractorProfileId("yossi")],
      ["h2", DEMO_IDS.pm],
    ]);
  });

  it("connecting: exchanges the code, subscribes, asks for contacts and history once", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const calls: string[] = [];
    const graph = {
      exchangeCode: async () => (calls.push("code"), "tok"),
      displayPhone: async () => "+972 55-724-2018",
      subscribe: async () => void calls.push("subscribe"),
      sync: async (_: string, __: string, type: string) => void calls.push(type),
    };
    const link = await connectWhatsapp(pm, graph, { code: "abc", wabaId: "222222", phoneNumberId: PID });
    expect(link).toMatchObject({ phone_number_id: PID, status: "connected", display_phone: "+972 55-724-2018" });
    expect(calls).toEqual(["code", "subscribe", "smb_app_state_sync", "history"]);
    await connectWhatsapp(pm, graph, { code: "abc", wabaId: "222222", phoneNumberId: PID });
    expect(calls.filter((c) => c === "history")).toHaveLength(1);
    await expect(connectWhatsapp(await ctxFor("shor", store), graph, { code: "x", wabaId: "222222", phoneNumberId: "333333" })).rejects.toThrow();
  });

  it("a followed chat's photo is saved and becomes the proof on the 'done, not checked' report", async () => {
    const { store, pm, yossiWa } = await setup();
    await store.update("whatsapp_links", { phone_number_id: PID }, { access_token: "tok" });
    const fetched: string[] = [];
    const deps = {
      fetchMedia: async (token: string, id: string) => (fetched.push(`${token}:${id}`), { bytes: Buffer.from("jpg"), mime: "image/jpeg" }),
      saveMedia: async (projectId: string) => `media/${projectId}/wa-photo.jpg`,
    };
    const payload = delivery([
      {
        field: "messages",
        value: {
          messages: [
            { id: "p1", from: yossiWa, timestamp: ts(2), type: "text", text: { body: "סיימתי חשמל בדירה 14" } },
            { id: "p2", from: yossiWa, timestamp: ts(2), type: "image", image: { id: "media-77", caption: "" } },
            { id: "p3", from: "972501234777", timestamp: ts(2), type: "image", image: { id: "media-stranger" } },
          ],
        },
      },
    ]);
    const { batches } = splitMirror(payload, new Set([PID]));
    await handleMirror(store, batches[0], NOW, deps);
    // only the followed chat's media is downloaded
    expect(fetched).toEqual(["tok:media-77"]);
    const photo = store.data.source_items.find((i) => i.external_id === "p2")!;
    expect(photo).toMatchObject({ kind: "image", media_url: `media/${pm.s.project.id}/wa-photo.jpg` });

    const done = store.data.project_events.find((e) => e.type === "reported_done" && e.quote?.includes("דירה 14"))!;
    await applyEvent(pm, done.id);
    const report = store.data.completion_reports.find((r) => r.status === "pending" && r.note?.includes("דירה 14"))!;
    expect(report.photo_urls).toEqual([photo.media_url]);
  });
});
