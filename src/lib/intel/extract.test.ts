import { describe, expect, it } from "vitest";
import { contractorId, sid } from "@/lib/seed/demo";
import { demoStore, NOW } from "@/test/fixtures";
import { areasIn, clauses, dateFrom, extractEvents, listItems, matchTasks, type ProjectFacts, type Speaker } from "./extract";
import { Learner } from "./learn";

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

  it("skips money, requests to update, and a condition that ends the line above", () => {
    const toYossi = (text: string) => expect(extractEvents(text, { ...opts(ido, f), counterpart: f.contractors.find((c) => c.id === contractorId("yossi"))! })).toEqual([]);
    toYossi("חסר. לי בתשלום הקודם 130 אין לי מאיפה לשלם החודש הזה");
    toYossi("אני אביא לאתר היום את הפלאנגים של הממ״ד 8 צול\n\nתעדכן אותי מה חסר לך");
    toYossi("המסגר מגיע היום. אשמח שיתחיל עם הסולמות, זה הדחוף ביותר. אם\nחסר לו חומר או שהוא צריך משהו, שידבר איתי ישירות.");
    toYossi("אני אבוא לצלם קודם, נראה אם צריך לתקן בכלל");
  });

  it("a PM's instruction with an apartment becomes a new task; without one, or a price request, it does not", () => {
    const toYossi = (text: string) => extractEvents(text, { ...opts(ido, f), counterpart: f.contractors.find((c) => c.id === contractorId("yossi"))! });
    for (const t of ["עז אני צריך להחליף משקוף בדירה 15", "תסיים לי בבקשה את התפסנות בממ״ד דירה 14 🙏", "בוקר טוב.\nאני רוצה להזמין דלת ומשקוף לממ״ד דירה 15"]) {
      const [e] = toYossi(t);
      expect(e?.type, t).toBe("new_task");
      expect(e.areaIds).toHaveLength(1);
    }
    expect(toYossi("תעדכן אותי מחיר להחלפת משקוף בדירה 15")).toEqual([]);
    expect(toYossi("צריך גם להתחיל חגורות מסביב למעליות")).toEqual([]);
    expect(toYossi("עז מחר יגיעו להתקין את הפלנים הסולארים")).toEqual([]);
  });

  it("still reads real updates", () => {
    expect(extractEvents("זה לא תקין, יש סדק בריצוף בדירה 9", opts(ido, f))[0].type).toBe("defect");
    expect(extractEvents("בדקתי את החשמל בדירה 14, תקין", opts(ido, f))[0].type).toBe("inspected_ok");
  });
});

describe("punch lists and learning", () => {
  const f = factsOf();
  const ido: Speaker = { name: "עידו", role: "pm", contractorId: null };
  const LIST = [
    "בוקר טוב עז",
    "ביקשת רשימה למג'ד:",
    "",
    "דירה 3",
    "* השירותים נוזלים לקומה מתחת",
    "*אני אתאם ואעדכן בהתאם*",
    "",
    "דירה 14",
    "* ספרינקלרים לסיים + חבק בממ\"ד",
    "* תיקון צנרת מזגן ממ\"ד",
    "* דירה 15: ניקיון ניקוזים",
    "* יש תמונה אם צריך*",
    "",
    "שטחים משותפים",
    "* בדיקת צנרת כיבוי אש",
    "<This message was edited>",
  ].join("\n");
  const name = (id: string) => f.areas.find((a) => a.id === id)!.name;

  it("splits a list under apartment headings into one task per line, in its apartment", () => {
    const events = extractEvents(LIST, opts(ido, f));
    expect(events.map((e) => [e.type, e.areaIds.map(name).join(), e.quote])).toEqual([
      ["new_task", "דירה 3", "השירותים נוזלים לקומה מתחת"],
      ["new_task", "דירה 14", 'ספרינקלרים לסיים + חבק בממד'],
      ["new_task", "דירה 14", 'תיקון צנרת מזגן ממד'],
      ["new_task", "דירה 15", "ניקיון ניקוזים"],
    ]);
  });

  it("does not take two plain reports for a list", () => {
    expect(listItems("סיימתי דירה 14\nסיימתי דירה 15", f.areas)).toBeNull();
  });

  it("uses what the PM approved or dismissed", () => {
    const yossi = f.contractors.find((c) => c.id === contractorId("yossi"))!;
    const ctx = { ...opts(ido, f), counterpart: yossi };
    // the rules miss this one…
    expect(extractEvents("המשקוף בדירה 15 זז ממקומו לגמרי", ctx)).toEqual([]);
    // …until the PM marked a similar message by hand
    const learner = new Learner([{ id: "m1", type: "defect", text: "המשקוף בדירה 9 זז ממקומו", positive: true }]);
    const [e] = extractEvents("המשקוף בדירה 15 זז ממקומו לגמרי", { ...ctx, learner });
    expect(e).toMatchObject({ type: "defect", learnedFrom: "m1" });
    // a rule hit that reads like something dismissed is dropped
    const no = new Learner([{ id: "d1", type: "new_task", text: "אני רוצה להזמין דלת ומשקוף לממד", positive: false }]);
    expect(extractEvents("אני רוצה להזמין דלת ומשקוף לממ״ד דירה 15", { ...ctx, learner: no })).toEqual([]);
  });
});
