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
import type { Learner } from "./learn";

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
  /** proposed because it reads like an update the PM approved or marked before */
  learnedFrom?: string | null;
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
  ask: /(^|\s)(תעדכן|תעדכני|תגיד לי|תודיע|תשאל|מה|מי|איפה|מתי|למה|כמה|האם)(\s|$)/,
  // a PM's instruction anywhere in the sentence: "עז אני צריך להחליף משקוף בדירה 15", "תסיים לי את התפסנות בממ״ד דירה 14"
  order: words([
    "צריך", "צריכים", "חייב", "חייבים", "רוצה ל\\p{L}+", "נא ל\\p{L}+", "יש ל\\p{L}+",
    "תסיים", "תסגור", "תתקן", "תתקין", "תבצע", "תעשה", "תסמן", "תבדוק", "תפרק", "תחליף", "תזיז", "תנקה", "תצבע", "תכין", "תשלים", "תוסיף", "תוריד", "תיישר", "תאטום", "תיצוק", "תחזק", "תזמין",
    "לסיים", "לסגור", "לתקן", "להתקין", "לבצע", "לעשות", "לסמן", "לבדוק", "לפרק", "להחליף", "להזיז", "לנקות", "לצבוע", "להכין", "להשלים", "להוסיף", "להוריד", "ליישר", "לאטום", "לצקת", "להזמין",
  ]),
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

/** Questions, conditions, money talk and requests to report back are never updates. */
function isNoise(c: string): boolean {
  if (/\?/.test(c) || c.length > MAX_CLAUSE) return true;
  // "אם…", "אחרי ש…" talk about what may happen, not about what happened
  if (RX.conditional.test(c) && !RX.except.test(c)) return true;
  // money between people is not a site update; asking "מה חסר" is not a report
  return RX.money.test(c) || RX.ask.test(c);
}

function typeOf(c: string, speaker: Speaker): EventType | null {
  if (isNoise(c)) return null;
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
  if ((RX.newTask.test(c) || RX.order.test(c)) && speaker.role === "pm" && c.split(" ").length >= 4) return "new_task";
  return null;
}

/**
 * A punch list: lines under (or starting with) an apartment / floor / named
 * area — "דירה 14\n* ספרינקלרים…" or "* דירה 3: השירותים נוזלים". Each line
 * becomes an item tied to its area. Null when the message is not such a list.
 */
export function listItems(text: string, areas: Area[]): Array<{ text: string; areas: Area[] }> | null {
  const items: Array<{ text: string; areas: Area[] }> = [];
  let current: Area[] = [];
  let anchors = 0;
  for (const raw of text.split(/\n+/)) {
    const bullet = /^\s*(?:[*•·\-–]|\d+[.)])/.test(raw);
    const line = raw.replace(/^\s*(?:[*•·\-–]+|\d+[.)])\s*/, "").replace(/\*+/g, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    const head = colon > 0 && colon <= 30 ? line.slice(0, colon) : null;
    const headAreas = head ? areasIn(head, areas) : [];
    if (head && headAreas.length) {
      // "דירה 3: השירותים נוזלים"
      anchors++;
      current = headAreas;
      const rest = line.slice(colon + 1).trim();
      if (rest) items.push({ text: rest, areas: headAreas });
      continue;
    }
    const own = areasIn(line, areas);
    if (!bullet && line.length <= 30) {
      // a heading: "דירה 14", "דירה 21 (מרפסת)", "קומה 7 לובי" sets the area…
      if (own.length && isAreaHeading(line, own)) {
        anchors++;
        current = own;
        continue;
      }
      // …"שטחים משותפים", "בוקר טוב עז", "טופס 4:" end it
      if (!own.length && line.split(/\s+/).length <= 4) {
        current = [];
        continue;
      }
    }
    items.push({ text: line, areas: own.length ? own : current });
  }
  return anchors >= 2 && items.length >= 2 ? items.filter((i) => i.areas.length) : null;
}

/** "דירה 21 (מרפסת)" is a heading; "סיימתי דירה 14" is not. */
function isAreaHeading(line: string, own: Area[]): boolean {
  const names = own.flatMap((a) => a.name.split(/\s+/));
  const rest = line
    .replace(/\([^)]*\)/g, " ")
    .replace(/(דירה|דירת|דירות|קומה|קומות)\s+[\d\s,\-–ו]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !names.includes(w));
  return rest.length === 0;
}

export interface ReadContext {
  speaker: Speaker;
  counterpart: Contractor | null;
  sentAt: Date;
  timeZone: string;
  facts: ProjectFacts;
  /** what the PM approved, dismissed or marked before */
  learner?: Learner | null;
}

/**
 * Events in one message. `counterpart` is the other side of a 1:1 chat (the
 * contractor the PM is talking to), used when the PM writes "סיים" without a name.
 */
export function extractEvents(rawText: string, ctx: ReadContext): ExtractedEvent[] {
  const cleanText = rawText.replace(RX.marker, " ").trim();
  const text = normalize(cleanText);
  if (text.length < 5 || ACK.test(text)) return [];
  const { facts, speaker, learner } = ctx;
  const out: ExtractedEvent[] = [];

  // a punch list: every line is a task in its area (or what the line itself says)
  const list = text.length <= 6000 ? listItems(cleanText, facts.areas) : null;
  if (list) {
    for (const item of list) {
      const clause = normalize(item.text);
      // the PM's own notes inside the list ("אני אתאם ואעדכן") are not tasks
      if (isNoise(clause) || /^אני\s/.test(clause) || clause.split(/\s+/).length < 2) continue;
      let type = typeOf(clause, speaker) ?? (speaker.role === "pm" ? "new_task" : null);
      let learnedFrom: string | null = null;
      if (!type && learner) {
        const g = learner.guess(clause);
        if (g) [type, learnedFrom] = [g.type, g.exampleId];
      }
      if (!type || (learner && !learnedFrom && learner.vetoes(clause, type))) continue;
      const e = build(clause, type, ctx, item.areas);
      if (e) out.push({ ...e, learnedFrom });
    }
    return out;
  }

  // long chatty messages (a story, a link, a debate) are not site updates
  if (text.length > 700) return [];
  for (const clause of clauses(cleanText).map(normalize)) {
    let type = typeOf(clause, speaker);
    let learnedFrom: string | null = null;
    if (type && learner?.vetoes(clause, type)) continue;
    if (!type && learner && !isNoise(clause)) {
      const g = learner.guess(clause);
      if (g) [type, learnedFrom] = [g.type, g.exampleId];
    }
    if (!type) continue;
    const e = build(clause, type, ctx, null);
    if (e) out.push({ ...e, learnedFrom });
  }
  return out;
}

/** Tie one clause to who / what / where; null when it cannot be tied to anything. */
function build(clause: string, type: EventType, ctx: ReadContext, listAreas: Area[] | null): ExtractedEvent | null {
  const { facts, speaker } = ctx;
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
  const inText = areasIn(main, facts.areas);
  const areas = inText.length ? inText : listAreas ?? [];
  const except = rest ? areasIn(rest, facts.areas) : [];
  const all = RX.all.test(main) && areas.length === 0;
  const date = type === "commitment" ? dateFrom(clause, ctx.sentAt, ctx.timeZone) : null;
  // nothing to tie it to (no one, no trade, no place) → it is chatter, not an update
  if (!contractor && !tradeKey && !areas.length && !all) return null;
  // a date is someone's promise only when they said it, or were named ("מחר יגיעו…" to the chat partner is not)
  if (type === "commitment" && (!date || (!named.length && speaker.role !== "contractor"))) return null;
  // a new task or a defect is only useful with a place
  if ((type === "new_task" || type === "defect") && !areas.length && !all) return null;

  let confidence = 0.55;
  if (areas.length || all) confidence += 0.15;
  if (contractor) confidence += 0.1;
  if (tradeKey) confidence += 0.05;
  return {
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
  };
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
