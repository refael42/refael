import { describe, expect, it } from "vitest";
import { exportMessageKeys, parseWhatsAppExport } from "@/lib/import/whatsapp-export";
import { contractorProfileId, sid } from "@/lib/seed/demo";
import { ctxFor, demoStore } from "@/test/fixtures";
import { applyEvent, dismissEvent, listEvents, processSource, reprocessSource } from "./intel";
import { importChatChunk, setSpeaker } from "./sources";

const CHAT = [
  "04.10.2026, 07:30 - רפאל כהן: יוסי סיים את כל החשמל",
  "חוץ מדירות 17 ו-18",
  "04.10.2026, 07:40 - יוסי חשמל: אין חשמל זמני בקומה 2",
  "04.10.2026, 07:41 - יוסי חשמל: סבבה",
  "04.10.2026, 07:45 - רפאל כהן: בדקתי את החשמל בדירה 14, תקין",
].join("\n");

async function imported() {
  const store = demoStore();
  const pm = await ctxFor("pm", store);
  const said = parseWhatsAppExport(CHAT).messages.filter((m) => m.author);
  const keys = exportMessageKeys(said);
  const { sourceId } = await importChatChunk(pm, {
    title: "יוסי חשמל",
    isGroup: false,
    since: null,
    messages: said.map((m, i) => ({ key: keys[i], sentAt: m.sentAt.toISOString(), author: m.author!, text: m.text, kind: "text" as const, attachment: null, mediaUrl: null })),
  });
  await setSpeaker(pm, sourceId, "יוסי חשמל", { profileId: contractorProfileId("yossi") });
  return { store, pm, sourceId };
}

describe("events from chat", () => {
  it("reads waiting messages once into events matched to tasks", async () => {
    const { store, pm, sourceId } = await imported();
    const r = await processSource(pm, sourceId);
    expect(r).toMatchObject({ processed: 4, remaining: 0 });
    expect(r.events).toBe(3);
    expect(store.data.source_items.every((i) => i.status === "processed")).toBe(true);
    // a second run finds nothing new
    expect((await processSource(pm, sourceId)).processed).toBe(0);
    const cards = await listEvents(pm);
    expect(cards.map((c) => c.event.type).sort()).toEqual(["blocker", "inspected_ok", "reported_done"]);
    const done = cards.find((c) => c.event.type === "reported_done")!;
    expect(done.author).toBe("רפאל כהן");
    expect(done.sourceTitle).toBe("יוסי חשמל");
    expect(done.tasks.length).toBeGreaterThan(3);
    expect(done.event.summary).toContain("חוץ מ");
  });

  it("applying 'reported done' makes the tasks 'done, not inspected' with the quote; dismiss leaves them", async () => {
    const { store, pm, sourceId } = await imported();
    await processSource(pm, sourceId);
    const done = (await listEvents(pm)).find((c) => c.event.type === "reported_done")!;
    const pick = done.tasks.slice(0, 2).map((t) => t.id);
    const r = await applyEvent(pm, done.event.id, { taskIds: pick });
    expect(r.changed).toBe(2);
    for (const id of pick) {
      expect((await store.byId("tasks", id))!.status).toBe("awaiting_approval");
      expect(store.data.completion_reports.find((c) => c.task_id === id && c.status === "pending")!.note).toContain("חוץ מדירות 17 ו-18");
    }
    expect(store.data.audit_log.some((a) => a.entity_id === pick[0] && (a.meta as { quote?: string })?.quote)).toBe(true);
    await expect(applyEvent(pm, done.event.id)).rejects.toThrow();

    const blocker = (await listEvents(pm)).find((c) => c.event.type === "blocker")!;
    await dismissEvent(pm, blocker.event.id);
    expect((await listEvents(pm)).some((c) => c.event.id === blocker.event.id)).toBe(false);
  });

  it("an inspection completes the task and releases what waits for it; only the PM decides", async () => {
    const { store, pm, sourceId } = await imported();
    await processSource(pm, sourceId);
    const ok = (await listEvents(pm)).find((c) => c.event.type === "inspected_ok")!;
    expect(ok.tasks.map((t) => t.id)).toContain(sid("task:E14"));
    const viewer = await ctxFor("viewer", store);
    await expect(applyEvent(viewer, ok.event.id)).rejects.toThrow();
    await applyEvent(pm, ok.event.id, { taskIds: [sid("task:E14")] });
    expect((await store.byId("tasks", sid("task:E14")))!.status).toBe("done");
  });

  it("reading again drops undecided suggestions and keeps the decided ones", async () => {
    const { store, pm, sourceId } = await imported();
    await processSource(pm, sourceId);
    const [first] = await listEvents(pm);
    await dismissEvent(pm, first.event.id);
    const before = store.data.project_events.length;
    const r = await reprocessSource(pm, sourceId);
    expect(r.removed).toBe(before - 1);
    expect(store.data.project_events.map((e) => e.id)).toEqual([first.event.id]);
    expect(store.data.source_items.filter((i) => i.status === "processed").map((i) => i.id)).toEqual([first.event.source_item_id]);
    const again = await processSource(pm, sourceId);
    expect(again.processed).toBe(3);
    expect(store.data.project_events.length).toBe(before);
    await expect(reprocessSource(await ctxFor("viewer", store), sourceId)).rejects.toThrow();
  });
});
