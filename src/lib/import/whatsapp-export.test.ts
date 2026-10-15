import { describe, expect, it } from "vitest";
import { chatTitleFromFileName, parseWhatsAppExport, zonedToUtc } from "./whatsapp-export";

const ANDROID = [
  "12.10.2026, 07:58 - ההודעות והשיחות מוצפנות מקצה לקצה. לאף אחד מחוץ לצ'אט הזה אין אפשרות לקרוא אותן.",
  "12.10.2026, 08:02 - פז מיזוג: בוקר טוב",
  "12.10.2026, 08:03 - פז מיזוג: סיימתי את כל המיזוג",
  "חוץ מדירות 17 ו-18",
  "12.10.2026, 08:05 - רפאל: מעולה",
  "12.10.2026, 08:06 - פז מיזוג: IMG-20261012-WA0004.jpg (קובץ מצורף)",
  "12.10.2026, 08:07 - פז מיזוג: <המדיה הושמטה>",
  "12.10.2026, 08:08 - פז מיזוג: ההודעה נמחקה",
  "13.10.2026, 23:30 - +972 50-123-4567: מי זה?",
].join("\n");

const IOS = [
  "‎[12/10/2026, 14:05:33] קבוצת אימבר 16: ‎ההודעות והשיחות מוצפנות מקצה לקצה.",
  "[12/10/2026, 14:06:10] עידו: אין חשמל זמני בקומה 2",
  "[12/10/2026, 14:07:02] יוסי חשמל: ‎<מצורף: 00000012-PHOTO-2026-10-12-14-07-02.jpg>",
  "[12/10/2026, 14:08:00] יוסי חשמל: ‎image omitted",
].join("\n");

describe("WhatsApp chat export", () => {
  it("reads an Android export: system lines, multi-line messages, attachments, deletions", () => {
    const { messages, participants } = parseWhatsAppExport(ANDROID);
    expect(messages[0]).toMatchObject({ author: null, kind: "system" });
    const said = messages.filter((m) => m.author);
    expect(said.map((m) => m.author)).toEqual(["פז מיזוג", "פז מיזוג", "רפאל", "פז מיזוג", "פז מיזוג", "+972 50-123-4567"]);
    expect(said[1].text).toBe("סיימתי את כל המיזוג\nחוץ מדירות 17 ו-18");
    expect(said[3]).toMatchObject({ kind: "image", attachment: "IMG-20261012-WA0004.jpg", text: "" });
    expect(said[4]).toMatchObject({ mediaOmitted: true, text: "" });
    expect(participants).toEqual(["פז מיזוג", "רפאל", "+972 50-123-4567"]);
    // Israel summer time (UTC+3): 08:02 local = 05:02 UTC
    expect(said[0].sentAt.toISOString()).toBe("2026-10-12T05:02:00.000Z");
  });

  it("reads an iPhone export with seconds and direction marks", () => {
    const { messages } = parseWhatsAppExport(IOS);
    expect(messages[0].kind).toBe("system");
    expect(messages[1]).toMatchObject({ author: "עידו", text: "אין חשמל זמני בקומה 2" });
    expect(messages[2]).toMatchObject({ kind: "image", attachment: "00000012-PHOTO-2026-10-12-14-07-02.jpg" });
    expect(messages[3].mediaOmitted).toBe(true);
    expect(messages[1].sentAt.toISOString()).toBe("2026-10-12T11:06:10.000Z");
  });

  it("works out month-first files and 12-hour clocks", () => {
    const { messages, dayFirst } = parseWhatsAppExport("10/25/26, 2:05 PM - Paz: done\n10/26/26, 12:10 AM - Paz: ok");
    expect(dayFirst).toBe(false);
    // winter time (UTC+2) after 25.10.2026
    expect(messages[0].sentAt.toISOString()).toBe("2026-10-25T12:05:00.000Z");
    expect(messages[1].sentAt.toISOString()).toBe("2026-10-25T22:10:00.000Z");
  });

  it("converts local time across daylight saving", () => {
    expect(zonedToUtc(2026, 1, 15, 9, 0, 0, "Asia/Jerusalem").toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(zonedToUtc(2026, 7, 15, 9, 0, 0, "Asia/Jerusalem").toISOString()).toBe("2026-07-15T06:00:00.000Z");
  });

  it("takes the chat name from the file name", () => {
    expect(chatTitleFromFileName("WhatsApp Chat with פז מיזוג.txt")).toBe("פז מיזוג");
    expect(chatTitleFromFileName("צ'אט WhatsApp עם קבוצת אימבר 16.zip")).toBe("קבוצת אימבר 16");
    expect(chatTitleFromFileName("_chat.txt")).toBeNull();
  });
});
