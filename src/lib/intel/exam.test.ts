/**
 * The reader's exam: messages the way they arrive from the site — forwarded
 * by the PM, written by contractors, or by the PM himself — and what each
 * one should become. A case that reads wrong is a bug in the reader.
 */
import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/seed/demo";
import { NOW } from "@/test/fixtures";
import { extractEvents, matchTasks, nextTopic, type ProjectFacts, type Speaker, type Topic } from "./extract";

const data = buildDemoData(NOW);
const facts: ProjectFacts = { areas: data.areas, trades: data.trades, contractors: data.contractors, tasks: data.tasks };
const contractor = (name: string) => data.contractors.find((c) => c.name === name)!;

const FWD: Speaker = { name: "הודעה שהועברה", role: null, contractorId: null };
const PM: Speaker = { name: "רפאל כהן", role: "pm", contractorId: null };
const by = (name: string): Speaker => ({ name, role: "contractor", contractorId: contractor(name).id });

interface Case {
  text: string;
  from?: Speaker;
  /** messages just before it in the same chat */
  before?: string[];
  type?: string | null;
  /** titles of the tasks it is about */
  tasks?: string[];
  date?: string;
}

const tomorrow = "2026-10-06"; // NOW is Monday 2026-10-05

const CASES: Case[] = [
  // ── done ──
  { text: "סיימתי את הטיח בדירה 6", type: "reported_done", tasks: ["טיח פנים – דירה 6"] },
  { text: "סיימנו טיח דירה 5", type: "reported_done", tasks: ["טיח פנים – דירה 5"] },
  { text: "דירה 6 מוכנה", type: "reported_done", tasks: ["טיח פנים – דירה 6"] },
  { text: "הטיח בדירה 6 גמור", type: "reported_done", tasks: ["טיח פנים – דירה 6"] },
  { text: "החשמל בדירה 14 בוצע", type: "reported_done", tasks: ["תשתיות חשמל – דירה 14"] },
  { text: "גמרנו את הגבס בדירה 8", type: "reported_done", tasks: ["סגירת קירות ותקרות גבס – דירה 8"] },
  { text: "סגרנו את הגבס בדירה 8", type: "reported_done", tasks: ["סגירת קירות ותקרות גבס – דירה 8"] },
  { text: "דירה 1 צבע ✅", type: "reported_done", tasks: ["צבע – דירה 1"] },
  { text: "טייחנו את דירה 5", type: "reported_done", tasks: ["טיח פנים – דירה 5"] },
  { text: "צבענו את דירה 1", type: "reported_done", tasks: ["צבע – דירה 1"] },
  { text: "האיטום בגג הסתיים", type: "reported_done", tasks: ["איטום גג"] },
  { text: "סיימנו איטום בגג", type: "reported_done", tasks: ["איטום גג"] },
  { text: "החיפוי בלובי הושלם", type: "reported_done", tasks: ["חיפוי אבן – לובי כניסה"] },
  { text: "סיימתי בדירה 14", from: by("יוסי"), type: "reported_done", tasks: ["תשתיות חשמל – דירה 14"] },
  { text: "רון סיים ריצוף בקומה 1", from: PM, type: "reported_done", tasks: ["ריצוף וחיפוי חדרים רטובים – קומה 1"] },
  { text: "אבי גמר לצבוע את דירה 1", from: PM, type: "reported_done", tasks: ["צבע – דירה 1"] },
  // the place (or the work) was said a moment before
  { text: "סיימתי", from: by("סאמר"), before: ["סאמר מה קורה עם דירה 6?"], type: "reported_done", tasks: ["טיח פנים – דירה 6"] },
  { text: "סיימנו את הגבס", before: ["דירה 8"], type: "reported_done", tasks: ["סגירת קירות ותקרות גבס – דירה 8"] },
  { text: "גמרנו שם", before: ["מה עם הטיח בדירה 5?"], type: "reported_done", tasks: ["טיח פנים – דירה 5"] },

  // ── started ──
  { text: "התחלנו גבס בדירה 10", type: "started", tasks: ["סגירת קירות ותקרות גבס – דירה 10"] },
  { text: "אבי התחיל לצבוע בדירה 2", from: PM, type: "started", tasks: ["צבע – דירה 2"] },
  { text: "נכנסנו לדירה 10 עם הגבס", type: "started", tasks: ["סגירת קירות ותקרות גבס – דירה 10"] },
  { text: "מתחילים היום צבע בדירה 2", type: "started", tasks: ["צבע – דירה 2"] },

  // ── inspected ──
  { text: "בדקתי את הגבס בדירה 9, תקין", from: PM, type: "inspected_ok", tasks: ["סגירת קירות ותקרות גבס – דירה 9"] },
  { text: "דירה 9 גבס עבר בדיקה", from: PM, type: "inspected_ok", tasks: ["סגירת קירות ותקרות גבס – דירה 9"] },
  { text: "אישרתי את הגבס בדירה 9", from: PM, type: "inspected_ok", tasks: ["סגירת קירות ותקרות גבס – דירה 9"] },

  // ── dates ──
  { text: "מחר אני מגיע לדירה 15 לחשמל", from: by("יוסי"), type: "commitment", tasks: ["תשתיות חשמל – דירה 15"], date: tomorrow },
  { text: "יוסי מגיע מחר לדירה 15", from: PM, type: "commitment", tasks: ["תשתיות חשמל – דירה 15"], date: tomorrow },
  { text: "ביום ג׳ מתחילים טיח בדירה 7", type: "commitment", tasks: ["טיח פנים – דירה 7"], date: "2026-10-06" },
  { text: "עד יום חמישי נסיים את הגבס בדירה 8", type: "commitment", tasks: ["סגירת קירות ותקרות גבס – דירה 8"], date: "2026-10-08" },
  { text: "בעוד יומיים נתחיל צבע בדירה 3", type: "commitment", tasks: ["צבע – דירה 3"], date: "2026-10-07" },
  { text: "בשבוע הבא מתחילים חשמל בדירה 16", type: "commitment", tasks: ["תשתיות חשמל – דירה 16"], date: "2026-10-12" },
  { text: "ב-30/10 מגיעים לדירה 17 עם החשמל", type: "commitment", tasks: ["תשתיות חשמל – דירה 17"], date: "2026-10-30" },

  // ── missing / stuck ──
  { text: "חסר חומר לטיח בדירה 7", type: "material_missing", tasks: ["טיח פנים – דירה 7"] },
  { text: "לא הגיעו האריחים לקומה 2", type: "material_missing", tasks: ["ריצוף וחיפוי חדרים רטובים – קומה 2"] },
  { text: "אי אפשר להתחיל צבע בדירה 3 כי הטיח לא נגמר", type: "blocker", tasks: ["צבע – דירה 3"] },
  { text: "מחכים לחשמלאי בדירה 15, לא יכולים לסגור גבס", type: "blocker" },
  { text: "אין מים בקומה 4", type: "blocker" },

  // ── defects ──
  { text: "יש סדק בטיח בדירה 5", from: PM, type: "defect" },
  { text: "נזילה בחדר רחצה דירה 13", type: "defect" },
  { text: "השקע בסלון לא עובד בדירה 14", type: "defect" },
  { text: "האריחים במקלחת בדירה 1 מתנדנדים", type: "defect" },
  { text: "הצבע מתקלף בדירה 1", type: "defect" },

  // ── the PM's own new work ──
  { text: "צריך לתקן את הדלת בדירה 12", from: PM, type: "new_task" },
  { text: "להוסיף נקודת חשמל במטבח דירה 16", from: PM, type: "new_task" },

  // ── not updates ──
  { text: "בוקר טוב", type: null },
  { text: "מתי אתה מגיע לדירה 14?", type: null },
  { text: "כמה עולה הטיח?", type: null },
  { text: "אם תסיים מחר את דירה 6 אני משלם", type: null },
  { text: "תודה רבה אחי", type: null },
  { text: "שלחתי לך את החשבונית על דירה 6", type: null },
  { text: "אני בדרך", type: null },
  { text: "הספק אמר שהחומר יגיע מחר", type: null },
  { text: "דיברתי עם האדריכל", type: null },
  { text: "סיימתי להיום, ממשיכים מחר", from: by("סאמר"), type: null },
  { text: "סיימנו להיום בדירה 6", type: null },
  { text: "גמרנו את הקפה 😂", type: null },
  { text: "מוכן?", type: null },
  // the new words, used for something else
  { text: "מחכה לך למטה ליד דירה 6", type: null },
  { text: "סגרנו על 5000 לדירה 6", type: null },
  { text: "סגרו את המים בדירה 14", type: null },
  { text: "סגרתי את החשמל הראשי בקומה 3", from: PM, type: null },
  { text: "אני מוכן לבוא מחר לדירה 7", type: null },
  { text: "האוטו מוכן", type: null },
  { text: "נכנס מים לדירה 13", type: null },
  { text: "מחר מגיע הבטון", type: null },
  { text: "התקציב אושר", type: null },
  { text: "לא יכול לבוא מחר לדירה 6", type: null },
  { text: "טופל?", type: null },
  // a place said long ago is not the topic any more
  { text: "סיימנו", before: ["@old דירה 8"], type: null },
];

function read(c: Case) {
  let topic: Topic | null = null;
  const start = NOW.getTime() - 5 * 60_000;
  for (const [i, raw] of (c.before ?? []).entries()) {
    const old = raw.startsWith("@old ");
    const at = new Date(old ? start - 6 * 3600_000 : start + i * 60_000);
    topic = nextTopic(topic, old ? raw.slice(5) : raw, at, facts);
  }
  const events = extractEvents(c.text, { speaker: c.from ?? FWD, counterpart: null, sentAt: NOW, timeZone: "Asia/Jerusalem", facts, topic });
  return events;
}

describe("reading exam", () => {
  for (const c of CASES) {
    const label = `${c.before ? `[${c.before.join(" | ")}] ` : ""}${c.text}`;
    it(label, () => {
      const events = read(c);
      if (c.type === null) {
        expect(events.map((e) => e.type)).toEqual([]);
        return;
      }
      const e = events.find((x) => x.type === c.type);
      expect(e, `read as: ${events.map((x) => x.type).join(", ") || "nothing"}`).toBeTruthy();
      if (c.tasks) expect(matchTasks(e!, facts).map((t) => t.title).sort()).toEqual([...c.tasks].sort());
      if (c.date) expect(e!.date).toBe(c.date);
    });
  }
});

describe("the project's own work types (from its Excel)", () => {
  it("'הדלתות בדירה 12 הותקנו' finds the doors task by the work type's name", () => {
    const doors = { id: "trade-doors", key: "t_doors", name: "דלתות", color: "#888", sort_order: 99 };
    const apt12 = data.areas.find((a) => a.name === "דירה 12")!;
    const task = { ...data.tasks.find((t) => t.area_id === apt12.id)!, id: "task-doors", title: "התקנת דלתות פנים – דירה 12", trade_id: doors.id, contractor_id: null, status: "in_progress" as const };
    const f: ProjectFacts = { ...facts, trades: [...facts.trades, doors], tasks: [...facts.tasks, task] };
    for (const text of ["הדלתות בדירה 12 הותקנו", "הנגר סיים את הדלת בדירה 12"]) {
      const [e] = extractEvents(text, { speaker: FWD, counterpart: null, sentAt: NOW, timeZone: "Asia/Jerusalem", facts: f });
      expect(e?.type, text).toBe("reported_done");
      expect(matchTasks(e, f).map((t) => t.id), text).toEqual(["task-doors"]);
    }
  });
});
