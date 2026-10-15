import { describe, expect, it } from "vitest";
import { exportMessageKeys, parseWhatsAppExport } from "@/lib/import/whatsapp-export";
import { contractorProfileId, DEMO_IDS } from "@/lib/seed/demo";
import { ctxFor, demoStore } from "@/test/fixtures";
import { deleteSource, guessSpeaker, importChatChunk, listSources, setSpeaker, sourceDetail, type IncomingMessage } from "./sources";

const CHAT = [
  "12.10.2026, 08:02 - יוסי חשמל: סיימתי חשמל בדירה 14",
  "12.10.2026, 08:05 - רפאל כהן: מעולה",
  "12.10.2026, 08:06 - +972 50-111-0006: מחר אני בקומה 3",
  "12.10.2026, 08:07 - שכן: מי זה?",
].join("\n");

function chunk(text: string, since: string | null = null) {
  const { messages } = parseWhatsAppExport(text);
  const said = messages.filter((m) => m.author);
  const keys = exportMessageKeys(said);
  const out: IncomingMessage[] = said.map((m, i) => ({
    key: keys[i],
    sentAt: m.sentAt.toISOString(),
    author: m.author!,
    text: m.text,
    kind: m.kind === "system" ? "text" : m.kind,
    attachment: m.attachment,
    mediaUrl: null,
  }));
  return { title: "קבוצת אימבר", isGroup: true, since, messages: out };
}

describe("chat export sources", () => {
  it("stores each message once, with who wrote it; re-importing adds only what is new", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const first = await importChatChunk(pm, chunk(CHAT));
    expect(first.added).toBe(4);
    const again = await importChatChunk(pm, chunk(`${CHAT}\n13.10.2026, 07:00 - יוסי חשמל: מתחיל בדירה 15`));
    expect(again).toMatchObject({ added: 1, duplicates: 4 });

    const items = store.data.source_items.filter((i) => i.source_id === first.sourceId);
    const by = (a: string) => items.find((i) => i.author === a)!;
    expect(by("יוסי חשמל").author_profile_id).toBe(contractorProfileId("yossi")); // first-name guess
    expect(by("רפאל כהן").author_profile_id).toBe(DEMO_IDS.pm); // exact name
    expect(by("+972 50-111-0006").author_profile_id).toBe(contractorProfileId("moti")); // phone
    expect(by("שכן").author_profile_id).toBeNull();
    const src = store.data.sources.find((s) => s.id === first.sourceId)!;
    expect(src.speakers["יוסי חשמל"]).toMatchObject({ auto: true });
  });

  it("leaves out messages before the chosen date", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const r = await importChatChunk(pm, chunk(CHAT, "2026-10-12T05:06:00.000Z"));
    expect(r).toMatchObject({ added: 2, beforeSince: 2 });
  });

  it("the PM maps or ignores a speaker; the list shows what still needs naming", async () => {
    const store = demoStore();
    const pm = await ctxFor("pm", store);
    const { sourceId } = await importChatChunk(pm, chunk(CHAT));
    expect((await listSources(pm))[0]).toMatchObject({ messages: 4, waiting: 4, unknownSpeakers: 2 });
    await setSpeaker(pm, sourceId, "שכן", { profileId: null, ignore: true });
    await setSpeaker(pm, sourceId, "יוסי חשמל", { profileId: contractorProfileId("yossi") });
    expect((await listSources(pm))[0]).toMatchObject({ waiting: 3, unknownSpeakers: 0 });
    const detail = await sourceDetail(pm, sourceId);
    expect(detail.speakers.find((s) => s.author === "שכן")).toMatchObject({ ignore: true });

    const viewer = await ctxFor("viewer", store);
    await expect(setSpeaker(viewer, sourceId, "שכן", { profileId: null })).rejects.toThrow();
    const contractor = await ctxFor("yossi", store);
    await expect(listSources(contractor)).rejects.toThrow();

    await deleteSource(pm, sourceId);
    expect(store.data.source_items).toHaveLength(0);
  });

  it("guesses people only when it is unambiguous", () => {
    const people = [
      { id: "a", full_name: "פז טכנאי מזגנים", phone: "+972501234567" },
      { id: "b", full_name: "יוסי", phone: null },
      { id: "c", full_name: "יוסי אלומיניום", phone: null },
    ] as Parameters<typeof guessSpeaker>[1];
    expect(guessSpeaker("פז מיזוג", people)).toEqual({ profile_id: "a", auto: true });
    expect(guessSpeaker("יוסי", people)).toEqual({ profile_id: "b", auto: false });
    expect(guessSpeaker("יוסי חשמלאי", people)).toBeNull(); // two יוסי
    expect(guessSpeaker("050-123-4567", people)).toEqual({ profile_id: "a", auto: false });
  });
});
