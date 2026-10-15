/**
 * Local (free) reading of site chat into events — no AI, no cost.
 *
 * A message is cut into clauses; each clause may yield one event: work
 * reported done, started, inspected, a defect, a commitment with a date, a
 * missing material / approval, a blocker, an instruction change or a new
 * task. Names are matched against the project's areas, contractors and
 * trades. Deliberately conservative: a clause it is unsure about yields
 * nothing, and a fact it cannot place is sent to the PM as "needs info".
 */
import { findContractors, findTradeKey } from "../ai/heuristic";
import { hasWord, normalize } from "../ai/text";
import type { Area, Contractor, EventType, Task, Trade } from "../db/types";

export interface Speaker {
  name: string;
  role: "pm" | "contractor" | "viewer" | null;
  contractorId: string | null;
}

export interface ProjectFacts {
  areas: Area[];
  trades: Trade[];
  contractors: Contractor[];
  tasks: Task[];
}

export interface ExtractedEvent {
  type: EventType;
  quote: string;
  contractorId: string | null;
  tradeId: string | null;
  areaIds: string[];
  /** "all of them" ("כל המיזוג", "בכל הדירות") */
  all: boolean;
  exceptAreaIds: string[];
  /** YYYY-MM-DD, for commitments */
  date: string | null;
  commit: "start" | "finish" | null;
  confidence: number;
}

const ACK = /^(אוקי|אוקיי|ok|סבבה|תודה|תודה רבה|מעולה|יופי|בסדר|קיבלתי|טוב|כן|לא|👍|🙏|👌|✅|\p{Emoji}+)[.!\s]*$/iu;

const RX = {
  inspected: /(בדקתי|נבדק|נבדקה|עבר בדיקה|עברה בדיקה|עברו בדיקה|בדיקת לחץ (עברה|תקינה)|תקין|תקינה|תקינים|אושר על ידי|המפקח אישר|קיבלתי את העבודה)/,
  defect: /(ליקוי|ליקויים|סדק|סדקים|נזילה|נוזל|רטיבות|שבור|שבורה|פגום|פגומה|עקום|עקומה|לא ישר|לא מפולס|נזק|נפגע|לא תקין|צריך לתקן|לתקן את|תיקון של)/,
  approval: /(מחכה לאישור|מחכים לאישור|ממתין לאישור|ממתינים לאישור|צריך אישור|לא אושר|אין אישור)/,
  material: /(חסר|חסרה|חסרים|חסרות|לא הגיע|לא הגיעה|לא הגיעו|אין (לי |לנו )?(חומר|סחורה|צנרת|אריחים|ראשים|ברגים|פרופילים)|מחכה ל(חומר|סחורה|משלוח|הספקה)|מחכים ל(חומר|סחורה|משלוח|הספקה))/,
  blocker: /(אי אפשר|אי-אפשר|לא ניתן|לא יכול להתחיל|לא יכולים להתחיל|תקוע|תקועים|נתקענו|מחכה ל|מחכים ל|ממתין ל|ממתינים ל|אין חשמל|אין מים|אין גישה|חסום|חסומה)/,
  done: /(^|\s)(סיימתי|סיימנו|סיים|סיימה|סיימו|גמרתי|גמרנו|גמר|גמרו|הסתיים|הסתיימה|הסתיימו|הושלם|הושלמה|הושלמו|בוצע|בוצעה|בוצעו|מוכן לבדיקה|מוכנה לבדיקה|מוכנות לבדיקה)(?=\s|$|[.,!])/,
  started: /(התחלתי|התחלנו|התחיל|התחילה|התחילו|אני בדירה|אנחנו בדירה|עובד עכשיו ב|עובדים עכשיו ב|נכנסנו ל|נכנסתי ל)/,
  future: /(מחר|מחרתיים|ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי)|בשבוע הבא|ב-?\s?\d{1,2}[./]\d{1,2})/,
  commitWord: /(אגיע|נגיע|יגיע|יגיעו|אתחיל|נתחיל|יתחיל|יתחילו|אסיים|נסיים|יסיים|יסיימו|אהיה|נהיה|אבוא|נבוא|יבוא|יבואו|אעשה|נעשה)/,
  finishWord: /(אסיים|נסיים|יסיים|יסיימו|יהיה מוכן|תהיה מוכנה|יהיו מוכנים)/,
  change: /(שינוי|לשנות|שונה|האדריכל ביקש|המתכנן ביקש|הלקוח ביקש|הדייר ביקש|להזיז|להעביר את|במקום ה|לבטל את|בוטל|מבטלים)/,
  newTask: /^(צריך|צריכה|צריכים|יש ל|חייב|חייבים|נא ל|תבצע|תעשה|תתקין|תסמן|תבדוק|תסגור|תתקן|תזמין|לבצע|להזמין|להתקין|לסגור|לבדוק)/,
  all: /(^|\s)(כל ה|בכל ה|את כל|לכל ה|כולם|כולן|הכל|הכול)/,
  except: /(חוץ מ|חוץ מה|מלבד|פרט ל|למעט|בלי )/,
  firstPerson: /(סיימתי|סיימנו|גמרתי|גמרנו|התחלתי|התחלנו|אגיע|נגיע|אתחיל|נתחיל|אסיים|נסיים|אני |אנחנו |בדקתי|אהיה|נהיה|אבוא|נבוא)/,
};

const WEEKDAY: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5 };

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "מחר", "ביום שלישי", "ב-24.10" → a date relative to when the message was sent. */
export function dateFrom(text: string, sentAt: Date, timeZone: string): string | null {
  const today = localDay(sentAt, timeZone);
  if (/מחרתיים/.test(text)) return addDays(today, 2);
  if (/מחר/.test(text)) return addDays(today, 1);
  if (/היום/.test(text)) return today;
  const wd = text.match(/ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי)/);
  if (wd) {
    const now = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (WEEKDAY[wd[1]] - now + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }
  if (/בשבוע הבא/.test(text)) return addDays(today, 7);
  const dm = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (dm) {
    const [d, m] = [Number(dm[1]), Number(dm[2])];
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    let y = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return !dm[3] && iso < addDays(today, -30) ? `${y + 1}${iso.slice(4)}` : iso;
  }
  return null;
}

/** Areas named in a piece of text: "דירה 17", "דירות 17, 18 ו-19", "קומה 3", or any area name. */
export function areasIn(text: string, areas: Area[]): Area[] {
  const found = new Map<string, Area>();
  const byNumber = (type: Area["type"], n: string) =>
    areas.filter((a) => a.type === type && new RegExp(`(^|\\D)${n}(\\D|$)`).test(a.name));
  // "דירות 17, 18 ו-19" / "דירה 4" / "דירות 3-5"
  for (const m of text.matchAll(/(דירה|דירות|דירת|קומה|קומות)\s+((?:\d+\s*(?:,|ו-?|-|–|\s)\s*)*\d+)/g)) {
    const type = m[1].startsWith("קומ") ? "floor" : "apartment";
    const list = m[2];
    const range = list.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    const nums = range
      ? Array.from({ length: Math.max(0, Number(range[2]) - Number(range[1]) + 1) }, (_, i) => String(Number(range[1]) + i))
      : list.match(/\d+/g) ?? [];
    for (const n of nums) for (const a of byNumber(type, n)) found.set(a.id, a);
  }
  // named areas (גג, חניון, לובי, מרפסת…) that are not numbered apartments/floors
  for (const a of areas) {
    if (found.has(a.id) || /\d/.test(a.name) || a.type === "room") continue;
    if (a.name.length >= 3 && hasWord(text, a.name)) found.set(a.id, a);
  }
  return [...found.values()];
}

function tradeIdOf(trades: Trade[], key: string | null) {
  return key ? trades.find((t) => t.key === key)?.id ?? null : null;
}

/** Cut a message into clauses; "חוץ מ…" lines stay with the clause before them. */
export function clauses(text: string): string[] {
  const parts: string[] = [];
  for (const line of text.split(/\n+/)) {
    const l = line.trim();
    if (!l) continue;
    if (parts.length && RX.except.test(l.slice(0, 8))) parts[parts.length - 1] += ` ${l}`;
    else parts.push(...l.split(/(?<=[.!])\s+/).map((s) => s.trim()).filter(Boolean));
  }
  return parts;
}

function typeOf(c: string, speaker: Speaker): EventType | null {
  if (/\?\s*$/.test(c)) return null;
  if (RX.inspected.test(c) && speaker.role !== "contractor") return "inspected_ok";
  if (RX.defect.test(c)) return "defect";
  if (RX.approval.test(c)) return "approval_missing";
  if (RX.material.test(c)) return "material_missing";
  if (RX.blocker.test(c)) return "blocker";
  if (RX.done.test(c)) return "reported_done";
  if (RX.started.test(c)) return "started";
  if (RX.future.test(c) && RX.commitWord.test(c)) return "commitment";
  if (RX.change.test(c) && speaker.role !== "contractor") return "instruction_change";
  if (RX.newTask.test(c) && speaker.role === "pm") return "new_task";
  return null;
}

/**
 * Events in one message. `counterpart` is the other side of a 1:1 chat (the
 * contractor the PM is talking to), used when the PM writes "סיים" without a name.
 */
export function extractEvents(
  rawText: string,
  ctx: { speaker: Speaker; counterpart: Contractor | null; sentAt: Date; timeZone: string; facts: ProjectFacts },
): ExtractedEvent[] {
  const text = normalize(rawText);
  if (text.length < 5 || ACK.test(text)) return [];
  const { facts, speaker } = ctx;
  const out: ExtractedEvent[] = [];
  for (const clause of clauses(rawText).map(normalize)) {
    const type = typeOf(clause, speaker);
    if (!type) continue;
    const ex = clause.match(RX.except);
    const main = ex ? clause.slice(0, ex.index) : clause;
    const rest = ex ? clause.slice(ex.index! + ex[0].length) : "";

    const named = findContractors(main, facts.contractors);
    const own = speaker.contractorId ? facts.contractors.find((c) => c.id === speaker.contractorId) ?? null : null;
    const contractor =
      named[0] ??
      (speaker.role === "contractor" && (RX.firstPerson.test(main) || type !== "new_task") ? own : null) ??
      (speaker.role === "pm" ? ctx.counterpart : null);
    const tradeKey = findTradeKey(main);
    const tradeId = tradeIdOf(facts.trades, tradeKey) ?? contractor?.trade_id ?? null;
    const areas = areasIn(main, facts.areas);
    const except = rest ? areasIn(rest, facts.areas) : [];
    const all = RX.all.test(main) && areas.length === 0;
    const date = type === "commitment" ? dateFrom(clause, ctx.sentAt, ctx.timeZone) : null;

    let confidence = 0.55;
    if (areas.length || all) confidence += 0.15;
    if (contractor) confidence += 0.1;
    if (tradeKey) confidence += 0.05;
    out.push({
      type,
      quote: clause,
      contractorId: contractor?.id ?? null,
      tradeId,
      areaIds: areas.map((a) => a.id),
      all,
      exceptAreaIds: except.map((a) => a.id),
      date,
      commit: type === "commitment" ? (RX.finishWord.test(clause) ? "finish" : "start") : null,
      confidence: Math.min(0.9, confidence),
    });
  }
  return out;
}

/** Event types that act on existing tasks, and therefore need them. */
export const NEEDS_TASKS: EventType[] = ["reported_done", "started", "inspected_ok"];

/** All areas inside `ids` (themselves included). */
function within(areas: Area[], ids: string[]): Set<string> {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of areas) if (a.parent_id && out.has(a.parent_id) && !out.has(a.id)) (out.add(a.id), (grew = true));
  }
  return out;
}

/**
 * The open tasks an event is about. Contractor (or else trade) narrows the
 * work; areas — or "all" minus the exceptions — narrow where. Without any
 * place, a contractor's single task in progress is taken; otherwise nothing,
 * and the PM is asked.
 */
export function matchTasks(e: ExtractedEvent, facts: ProjectFacts): Task[] {
  const closed = e.type === "reported_done" ? ["done", "awaiting_approval"] : e.type === "inspected_ok" ? ["done"] : ["done"];
  let open = facts.tasks.filter((t) => !closed.includes(t.status));
  if (e.type === "started") open = open.filter((t) => t.status === "planned" || t.status === "ready");
  if (e.contractorId) open = open.filter((t) => t.contractor_id === e.contractorId);
  if (e.tradeId && (!e.contractorId || open.some((t) => t.trade_id === e.tradeId))) open = open.filter((t) => t.trade_id === e.tradeId);
  if (!e.contractorId && !e.tradeId) return [];

  const excluded = within(facts.areas, e.exceptAreaIds);
  if (e.areaIds.length) {
    const inside = within(facts.areas, e.areaIds);
    return open.filter((t) => t.area_id && inside.has(t.area_id) && !excluded.has(t.area_id));
  }
  if (e.all) return open.filter((t) => !t.area_id || !excluded.has(t.area_id));
  const active = open.filter((t) => t.status === "in_progress");
  return active.length === 1 ? active : [];
}
