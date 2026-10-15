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

/**
 * Whole words only, optionally after "ו" — so "תקין" never matches inside
 * "להתקין" / "מתקין", nor "התחיל" inside "להתחיל".
 */
function words(list: string[], prefix = "ו?"): RegExp {
  return new RegExp(`(?<![\\p{L}])${prefix}(?:${list.join("|")})(?![\\p{L}])`, "u");
}

const RX = {
  inspected: words(["בדקתי", "בדקנו", "נבדק", "נבדקה", "נבדקו", "עבר בדיקה", "עברה בדיקה", "עברו בדיקה", "בדיקת לחץ עברה", "תקין", "תקינה", "תקינים", "תקינות", "המפקח אישר", "קיבלתי את העבודה"]),
  defect: words(["ליקוי", "ליקויים", "סדק", "סדקים", "נזילה", "נזילות", "רטיבות", "שבור", "שבורה", "שבורים", "פגום", "פגומה", "פגומים", "עקום", "עקומה", "לא ישר", "לא מפולס", "לא מפולסת", "נזק", "לא תקין", "לא תקינה"], "[וב]?"),
  approval: words(["מחכה לאישור", "מחכים לאישור", "ממתין לאישור", "ממתינים לאישור", "צריך אישור", "לא אושר", "לא אושרה", "אין אישור"]),
  material: words(["חסר", "חסרה", "חסרים", "חסרות", "לא הגיע", "לא הגיעה", "לא הגיעו", "אין חומר", "אין לי חומר", "אין לנו חומר", "מחכה לחומר", "מחכים לחומר", "מחכה למשלוח", "מחכים למשלוח", "נגמר החומר"]),
  blocker: words(["אי אפשר", "אי-אפשר", "לא ניתן", "לא יכול להתחיל", "לא יכולים להתחיל", "תקוע", "תקועים", "נתקענו", "אין חשמל", "אין מים", "אין גישה", "חסום", "חסומה"]),
  done: words(["סיימתי", "סיימנו", "סיים", "סיימה", "סיימו", "גמרתי", "גמרנו", "גמר", "גמרו", "הסתיים", "הסתיימה", "הסתיימו", "הושלם", "הושלמה", "הושלמו", "מוכן לבדיקה", "מוכנה לבדיקה", "מוכנות לבדיקה"]),
  started: words(["התחלתי", "התחלנו", "התחיל", "התחילה", "התחילו", "אני בדירה", "אנחנו בדירה", "עובד עכשיו", "עובדים עכשיו", "נכנסנו", "נכנסתי"]),
  future: /(מחר|מחרתיים|ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי)|בשבוע הבא|ב-?\s?\d{1,2}[./]\d{1,2})/,
  commitWord: words(["אגיע", "נגיע", "אתחיל", "נתחיל", "אסיים", "נסיים", "אהיה", "נהיה", "אבוא", "נבוא", "אעשה", "נעשה", "יגיע", "יגיעו", "יתחיל", "יתחילו", "יסיים", "יסיימו"]),
  finishWord: words(["אסיים", "נסיים", "יסיים", "יסיימו", "יהיה מוכן", "תהיה מוכנה", "יהיו מוכנים"]),
  // an explicit change of plan, not an everyday instruction ("להזיז את הפלנים" is a task)
  change: words(["שינוי בתוכנית", "שינוי תוכנית", "שינוי בתכנית", "האדריכל ביקש", "המתכנן ביקש", "הקונסטרוקטור ביקש", "הלקוח ביקש", "הדייר ביקש", "הדיירים ביקשו", "לבטל את", "בוטל", "בוטלה", "מבטלים"]),
  newTask: /^(צריך|צריכה|צריכים|יש ל|חייב|חייבים|נא ל|תבצע|תעשה|תתקין|תסמן|תבדוק|תסגור|תתקן|לבצע|להתקין|לסגור|לבדוק|לתקן)/,
  all: /(^|\s)(כל ה|בכל ה|את כל|לכל ה|כולם|כולן|הכל|הכול)/,
  except: /(חוץ מ|חוץ מה|מלבד|פרט ל|למעט)/,
  firstPerson: /(סיימתי|סיימנו|גמרתי|גמרנו|התחלתי|התחלנו|אגיע|נגיע|אתחיל|נתחיל|אסיים|נסיים|אני |אנחנו |בדקתי|אהיה|נהיה|אבוא|נבוא)/,
  // "אחרי שהוא סיים…", "אם לא נעשה מחר…", "כשתסיים…" describe a condition, not a fact
  conditional: /(^|\s)(אם|אחרי ש|לאחר ש|ברגע ש|לפני ש|עד ש|כש|כאשר|במידה ו|ברגע שהוא|אחרי שהם)/,
  // WhatsApp markers that are not part of what was said
  openCondition: /(^|\s)(אם|במידה ו?|כש|ברגע ש|אחרי ש|לפני ש)\s*$/,
  money: words(["תשלום", "בתשלום", "לשלם", "שילמת", "שילמו", "כסף", "שקל", "שקלים", "ש״ח", "₪", "חשבונית", "משכורת", "מקדמה"], "[ובל]?"),
  ask: /(^|\s)(תעדכן|תעדכני|תגיד לי|תודיע|תבדוק|תשאל|מה|מי|איפה|מתי|למה|כמה|האם)(\s|$)/,
  marker: /<\s*(this message was edited|ההודעה נערכה|הודעה זו נערכה)\s*>/gi,
};

/** Clauses longer than this are conversation, not site updates. */
const MAX_CLAUSE = 220;


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
    const prev = parts[parts.length - 1];
    // "חוץ מ…" belongs to the line above; so does a line that finishes an "אם…"
    if (prev && (RX.except.test(l.slice(0, 8)) || RX.openCondition.test(prev))) parts[parts.length - 1] += ` ${l}`;
    else parts.push(...l.split(/(?<=[.!])\s+/).map((s) => s.trim()).filter(Boolean));
  }
  return parts;
}

function typeOf(c: string, speaker: Speaker): EventType | null {
  if (/\?/.test(c) || c.length > MAX_CLAUSE) return null;
  // "אם…", "אחרי ש…" talk about what may happen, not about what happened
  if (RX.conditional.test(c) && !RX.except.test(c)) return null;
  // money between people is not a site update; asking "מה חסר" is not a report
  if (RX.money.test(c) || RX.ask.test(c)) return null;
  if (RX.defect.test(c)) return "defect";
  if (RX.inspected.test(c) && speaker.role !== "contractor") return "inspected_ok";
  if (RX.approval.test(c)) return "approval_missing";
  const short = c.split(/\s+/).length < 3;
  if (RX.material.test(c) && !short) return "material_missing";
  if (RX.blocker.test(c) && !short) return "blocker";
  if (RX.done.test(c)) return "reported_done";
  if (RX.started.test(c)) return "started";
  if (RX.future.test(c) && RX.commitWord.test(c)) return "commitment";
  if (RX.change.test(c) && speaker.role !== "contractor") return "instruction_change";
  if (RX.newTask.test(c) && speaker.role === "pm" && c.split(" ").length >= 4) return "new_task";
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
  const cleanText = rawText.replace(RX.marker, " ").trim();
  const text = normalize(cleanText);
  // long chatty messages (a story, a link, a debate) are not site updates
  if (text.length < 5 || ACK.test(text) || text.length > 700) return [];
  const { facts, speaker } = ctx;
  const out: ExtractedEvent[] = [];
  for (const clause of clauses(cleanText).map(normalize)) {
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
    // nothing to tie it to (no one, no trade, no place) → it is chatter, not an update
    if (!contractor && !tradeKey && !areas.length && !all) continue;
    if (type === "commitment" && !date) continue;

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
