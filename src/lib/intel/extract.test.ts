import { describe, expect, it } from "vitest";
import { contractorId, sid } from "@/lib/seed/demo";
import { demoStore, NOW } from "@/test/fixtures";
import { areasIn, clauses, dateFrom, extractEvents, matchTasks, type ProjectFacts, type Speaker } from "./extract";

function factsOf(store = demoStore()): ProjectFacts {
  const d = store.data;
  return { areas: d.areas, trades: d.trades, contractors: d.contractors, tasks: d.tasks };
}
const PM: Speaker = { name: "רפאל", role: "pm", contractorId: null };
const yossi: Speaker = { name: "יוסי", role: "contractor", contractorId: contractorId("yossi") };
const opts = (speaker: Speaker, facts: ProjectFacts, counterpart = null) => ({ speaker, counterpart, sentAt: NOW, timeZone: "Asia/Jerusalem", facts });

describe("local event reading", () => {
  it("'X finished all … except 17 and 18' → reported done, all apartments minus the exceptions", () => {
    const f = factsOf();
    const [e] = extractEvents("יוסי סיים את כל החשמל\nחוץ מדירות 17 ו-18", opts(PM, f));
    expect(e).toMatchObject({ type: "reported_done", contractorId: contractorId("yossi"), all: true });
    expect(e.exceptAreaIds.sort()).toEqual([sid("area:apt17"), sid("area:apt18")].sort());
    const tasks = matchTasks(e, f);
    expect(tasks.length).toBeGreaterThan(3);
    expect(tasks.every((t) => t.contractor_id === contractorId("yossi") && !["done", "awaiting_approval"].includes(t.status))).toBe(true);
    expect(tasks.some((t) => t.area_id === sid("area:apt17") || t.area_id === sid("area:apt18"))).toBe(false);
  });

  it("a contractor's own 'סיימתי' in an apartment, and a list of apartments", () => {
    const f = factsOf();
    const [e] = extractEvents("סיימתי חשמל בדירה 14", opts(yossi, f));
    expect(e).toMatchObject({ type: "reported_done", contractorId: contractorId("yossi"), areaIds: [sid("area:apt14")] });
    expect(areasIn("דירות 3, 5 ו-7", f.areas).map((a) => a.name).sort()).toEqual(["דירה 3", "דירה 5", "דירה 7"]);
    expect(areasIn("דירות 9-11", f.areas)).toHaveLength(3);
  });

  it("commitments get a date from 'מחר' / a weekday / dd.mm", () => {
    const f = factsOf();
    const [e] = extractEvents("אני אגיע מחר לדירה 15 לסגור את החשמל", opts(yossi, f));
    expect(e).toMatchObject({ type: "commitment", date: "2026-10-06", commit: "start" });
    // 5.10.2026 is a Monday
    expect(dateFrom("ביום רביעי", NOW, "Asia/Jerusalem")).toBe("2026-10-07");
    expect(dateFrom("עד ה-24.10", NOW, "Asia/Jerusalem")).toBe("2026-10-24");
  });

  it("missing material, defects, blockers and noise", () => {
    const f = factsOf();
    expect(extractEvents("לא הגיעו הצנרת לקומה 3", opts(yossi, f))[0].type).toBe("material_missing");
    expect(extractEvents("יש סדק בריצוף בסלון של דירה 9", opts(PM, f))[0]).toMatchObject({ type: "defect", areaIds: [sid("area:apt9")] });
    expect(extractEvents("אין חשמל זמני בקומה 2", opts(yossi, f))[0].type).toBe("blocker");
    expect(extractEvents("סבבה תודה", opts(yossi, f))).toEqual([]);
    expect(extractEvents("סיימת כבר?", opts(PM, f))).toEqual([]);
    expect(clauses("סיימתי בדירה 4. מחר אני בדירה 5")).toEqual(["סיימתי בדירה 4.", "מחר אני בדירה 5"]);
  });
});

describe("real chat noise (Imber 16 export)", () => {
  const f = factsOf();
  const ido: Speaker = { name: "עידו", role: "pm", contractorId: null };
  const none = (text: string, who = ido) => expect(extractEvents(text, opts(who, f))).toEqual([]);

  it("does not read 'להתקין' / 'מתקין' as 'תקין', nor 'להתחיל' as 'התחיל'", () => {
    none("צריך להתקין דלת ממ״ד, תבדוק כמה זה עולה");
    none("יום ראשון מגיע מתקין עומר נתקין גם אותו");
    none("עז מחר יגיעו להתקין את הפלנים הסולארים");
    none("יוסי שמתקין את הציוד ממ״דים מגיע ברביעי.");
    none("צריך גם להתחיל חגורות מסביב למעליות");
  });

  it("skips conditions, questions, plain orders, edited markers and long chatter", () => {
    none("ולאחר מכן התקנת כל מאחז היד ושימדוד לי אחרי שהוא סיים כמה חומר הוא עוד צריך.");
    none("אם לא נעשה את זה מחר");
    none("להזיז את האבנים את הפלנים וכו");
    none("תזמין D400");
    none("להזמין חתך או שאתה חותך במקום? אני שוב מוודא");
    none("בוקר טוב עז, <This message was edited>");
    none("עז, בדקתי את מה שסיפרת לי היום ".repeat(30));
  });

  it("still reads real updates", () => {
    expect(extractEvents("זה לא תקין, יש סדק בריצוף בדירה 9", opts(ido, f))[0].type).toBe("defect");
    expect(extractEvents("בדקתי את החשמל בדירה 14, תקין", opts(ido, f))[0].type).toBe("inspected_ok");
  });
});
