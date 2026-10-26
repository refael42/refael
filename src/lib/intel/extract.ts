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
import { findContractors, findTrade, findTradeKey, TRADE_KEYS } from "../ai/heuristic";
import { escapeRe, hasWord, normalize } from "../ai/text";
import type { Area, Contractor, EventType, Task, Trade } from "../db/types";
import { zonedToUtc } from "../import/whatsapp-export";
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
  inspected: words(["בדקתי", "בדקנו", "נבדק", "נבדקה", "נבדקו", "עבר בדיקה", "עברה בדיקה", "עברו בדיקה", "בדיקת לחץ עברה", "תקין", "תקינה", "תקינים", "תקינות", "המפקח אישר", "קיבלתי את העבודה", "אישרתי", "אישרנו", "אושר", "אושרה", "אושרו", "מאושר", "מאושרת", "מאושרים"]),
  defect: words(["ליקוי", "ליקויים", "סדק", "סדקים", "נזילה", "נזילות", "רטיבות", "שבור", "שבורה", "שבורים", "פגום", "פגומה", "פגומים", "עקום", "עקומה", "לא ישר", "לא מפולס", "לא מפולסת", "נזק", "לא תקין", "לא תקינה", "לא עובד", "לא עובדת", "לא עובדים", "לא עובדות", "מתנדנד", "מתנדנדת", "מתנדנדים", "מתקלף", "מתקלפת", "מתקלפים", "מתפורר", "מתפוררת", "נוזל", "נוזלת", "נוזלים", "דולף", "דולפת", "דולפים", "רופף", "רופפת", "שריטה", "שריטות", "שרוט", "שרוטה"], "[וב]?"),
  approval: words(["מחכה לאישור", "מחכים לאישור", "ממתין לאישור", "ממתינים לאישור", "צריך אישור", "לא אושר", "לא אושרה", "אין אישור"]),
  material: words(["חסר", "חסרה", "חסרים", "חסרות", "לא הגיע", "לא הגיעה", "לא הגיעו", "אין חומר", "אין לי חומר", "אין לנו חומר", "מחכה לחומר", "מחכים לחומר", "מחכה למשלוח", "מחכים למשלוח", "נגמר החומר"]),
  blocker: words(["אי אפשר", "אי-אפשר", "לא ניתן", "לא יכול להתחיל", "לא יכולים להתחיל", "תקוע", "תקועים", "נתקענו", "אין חשמל", "אין מים", "אין גישה", "חסום", "חסומה",
    // can't go on with the work ("לא יכול לבוא מחר" is about a visit, not the work)
    "לא (?:יכול|יכולה|יכולים) (?:להתחיל|להמשיך|לעבוד|לסגור|לסיים|להתקין|לצקת|לטייח|לצבוע|לרצף|לאטום|להיכנס|לבצע|לגמור)",
    // waiting for someone (not "מחכה לך / לו / לכם")
    "מחכה ל(?!ך|ו|ה|י|נו|כם|כן|הם)\\p{L}{2,}", "מחכים ל(?!ך|ו|ה|י|נו|כם|כן|הם)\\p{L}{2,}", "ממתין ל\\p{L}{2,}", "ממתינים ל\\p{L}{2,}"]),
  done: words([
    "סיימתי", "סיימנו", "סיים", "סיימה", "סיימו", "גמרתי", "גמרנו", "גמר", "גמרו", "הסתיים", "הסתיימה", "הסתיימו", "הושלם", "הושלמה", "הושלמו",
    "בוצע", "בוצעה", "בוצעו", "סגרנו", "סגרתי", "נסגר", "נסגרה", "נסגרו", "השלמנו", "השלמתי", "טופל", "טופלה", "טופלו", "תוקן", "תוקנה", "תוקנו", "תיקנתי", "תיקנו",
    // the work itself, in the past: "טייחנו", "צבענו את דירה 1", "הותקנו החלונות"
    "הותקן", "הותקנה", "הותקנו", "התקנתי", "התקנו", "הרכבתי", "הרכבנו", "הורכב", "הורכבו", "טייחתי", "טייחנו", "צבעתי", "צבענו", "ריצפתי", "ריצפנו",
    "איטמתי", "איטמנו", "אטמנו", "יצקנו", "נוצק", "נוצקה", "חיפינו",
  ]),
  // "דירה 6 מוכנה", "הטיח גמור", "✅" — only when it is not about the future ("יהיה מוכן מחר")
  // ("אני מוכן לבוא" is willing, not ready)
  ready: /(?<![\p{L}])ו?(?:מוכן|מוכנה|מוכנים|מוכנות|גמור|גמורה|גמורים|גמורות)(?![\p{L}])(?!\s+ל(?!בדיקה)\p{L})|✅|✔️?|☑️?/u,
  // "סגרנו על 5000" is a deal; "סגרו את המים / החשמל" is a shut-off
  notDone: /סגר\p{L}*\s+(?:על\s|את\s+ה?(?:מים|חשמל|ברז|ראשי|גז))/u,
  // "סיימתי להיום" = done for the day, not done with the work
  forToday: /(סיימ|גמר)\p{L}*\s+(?:ל?היום|את היום|לעכשיו|בינתיים|לבינתיים|לשבוע|את השבוע)(?![\p{L}])/u,
  started: words(["התחלתי", "התחלנו", "התחיל", "התחילה", "התחילו", "אני בדירה", "אנחנו בדירה", "עובד עכשיו", "עובדים עכשיו", "נכנסנו", "נכנסתי"]),
  // "מתחילים היום צבע" — starting now (with a future day it is a commitment)
  starting: words(["מתחיל", "מתחילה", "מתחילים", "מתחילות", "נכנסים"]),
  future: /(מחר|מחרתיים|(?:ב|עד\s)?יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו](?![\p{L}]))|שבוע הבא|בעוד\s+(?:יומיים|שבוע|שבועיים|\d+\s+ימים)|ב-?\s?\d{1,2}[./]\d{1,2})/u,
  commitWord: words([
    "אגיע", "נגיע", "אתחיל", "נתחיל", "אסיים", "נסיים", "אהיה", "נהיה", "אבוא", "נבוא", "אעשה", "נעשה", "יגיע", "יגיעו", "יתחיל", "יתחילו", "יסיים", "יסיימו",
    "מגיע", "מגיעה", "מגיעים", "מתחיל", "מתחילה", "מתחילים", "מסיים", "מסיימים", "אגמור", "נגמור", "יגמור", "יגמרו", "נכנסים", "ייכנס", "ייכנסו", "נעבוד", "אעבוד",
    "יהיה מוכן", "תהיה מוכנה", "יהיו מוכנים", "יהיה גמור", "תהיה גמורה",
  ]),
  finishWord: words(["אסיים", "נסיים", "יסיים", "יסיימו", "מסיים", "מסיימים", "אגמור", "נגמור", "יגמור", "יגמרו", "יהיה מוכן", "תהיה מוכנה", "יהיו מוכנים", "יהיה גמור", "תהיה גמורה"]),
  // an explicit change of plan, not an everyday instruction ("להזיז את הפלנים" is a task)
  change: words(["שינוי בתוכנית", "שינוי תוכנית", "שינוי בתכנית", "האדריכל ביקש", "המתכנן ביקש", "הקונסטרוקטור ביקש", "הלקוח ביקש", "הדייר ביקש", "הדיירים ביקשו", "לבטל את", "בוטל", "בוטלה", "מבטלים"]),
  newTask: /^(צריך|צריכה|צריכים|יש ל|חייב|חייבים|נא ל|תבצע|תעשה|תתקין|תסמן|תבדוק|תסגור|תתקן|לבצע|להתקין|לסגור|לבדוק|לתקן)/,
  all: /(^|\s)(כל ה|בכל ה|את כל|לכל ה|כולם|כולן|הכל|הכול)/,
  except: /(חוץ מ|חוץ מה|מלבד|פרט ל|למעט)/,
  firstPerson: /(סיימתי|סיימנו|גמרתי|גמרנו|התחלתי|התחלנו|אגיע|נגיע|אתחיל|נתחיל|אסיים|נסיים|אני |אנחנו |בדקתי|אהיה|נהיה|אבוא|נבוא|\p{L}+(?:תי|נו)(?![\p{L}])|מגיעים|מתחילים)/u,
  // "אחרי שהוא סיים…", "אם לא נעשה מחר…", "כשתסיים…" describe a condition, not a fact
  conditional: /(^|\s)(אם|אחרי ש|לאחר ש|ברגע ש|לפני ש|עד ש|כש|כאשר|במידה ו|ברגע שהוא|אחרי שהם)/,
  // WhatsApp markers that are not part of what was said
  openCondition: /(^|\s)(אם|במידה ו?|כש|ברגע ש|אחרי ש|לפני ש)\s*$/,
  money: words(["תשלום", "בתשלום", "לשלם", "שילמת", "שילמו", "כסף", "שקל", "שקלים", "ש״ח", "₪", "חשבונית", "משכורת", "מקדמה", "מחיר", "הצעת מחיר"], "[ובל]?"),
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


const WEEKDAY: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, א: 0, ב: 1, ג: 2, ד: 3, ה: 4, ו: 5 };

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
  const wd = text.match(/(?:^|[\s(])(?:ב|עד\s)?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו](?![\p{L}]))/u);
  if (wd) {
    const now = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (WEEKDAY[wd[1]] - now + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }
  const inDays = text.match(/בעוד\s+(?:(יומיים)|(שבועיים)|(שבוע)|(\d+)\s+ימים)/);
  if (inDays) return addDays(today, inDays[1] ? 2 : inDays[2] ? 14 : inDays[3] ? 7 : Number(inDays[4]));
  if (/שבוע הבא/.test(text)) return addDays(today, 7);
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

const GENERIC_HEADS = new Set(["חדר", "חדרי", "שטח", "שטחי", "אזור"]);

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
    if (a.name.length >= 2 && hasWord(text, a.name)) found.set(a.id, a);
  }
  if (!found.size) {
    for (const a of areas) {
      if (/\d/.test(a.name) || a.type === "room") continue;
      const head = a.name.split(/[\s–-]+/)[0];
      if (head === a.name || head.length < 4 || GENERIC_HEADS.has(head)) continue;
      // only when no other area starts the same way
      if (areas.filter((b) => b.type !== "room" && b.name.startsWith(head)).length === 1 && hasWord(text, head)) found.set(a.id, a);
    }
  }
  return [...found.values()];
}

function tradeIdOf(trades: Trade[], key: string | null) {
  return key ? trades.find((t) => t.key === key)?.id ?? null : null;
}

/** "דלתות" ~ "הדלת", "נגרות" ~ "הנגר", "מטבחים" ~ "מטבח". */
function nameForms(name: string): string[] {
  const n = normalize(name);
  const out = [n];
  if (n.endsWith("ות") && n.length > 4) out.push(n.slice(0, -2), `${n.slice(0, -2)}ת`);
  if (n.endsWith("ים") && n.length > 4) out.push(n.slice(0, -2));
  return out;
}

/**
 * The trade a text names: a known word ("חשמל", "טייח"…) or the project's own
 * work type by its name ("דלתות", "מטבחים" from the Excel) — whichever comes first.
 */
export function tradeIn(text: string, trades: Trade[]): string | null {
  const known = findTrade(text);
  let best = known ? { at: known.at, id: tradeIdOf(trades, known.key) } : null;
  for (const t of trades) {
    if (TRADE_KEYS.has(t.key)) continue;
    for (const form of nameForms(t.name)) {
      if (form.length < 3) continue;
      const m = new RegExp(`(?:^|[^\\p{L}])[ובלמהש]{0,2}${escapeRe(form)}(?![\\p{L}])`, "u").exec(text);
      if (m && (!best || m.index < best.at)) best = { at: m.index, id: t.id };
    }
  }
  return best?.id ?? null;
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
  return RX.money.test(c) || RX.ask.test(c) || RX.forToday.test(c) || RX.notDone.test(c);
}

function typeOf(c: string, speaker: Speaker): EventType | null {
  if (isNoise(c)) return null;
  if (RX.defect.test(c)) return "defect";
  // "לא אושר" is a missing approval, not an inspection
  if (RX.approval.test(c)) return "approval_missing";
  if (RX.inspected.test(c) && speaker.role !== "contractor") return "inspected_ok";
  const short = c.split(/\s+/).length < 3;
  if (RX.material.test(c) && !short) return "material_missing";
  if (RX.blocker.test(c) && !short) return "blocker";
  // what happened beats what will happen; a ready state or "starting" only when no other day is named
  if (RX.done.test(c)) return "reported_done";
  if (RX.started.test(c)) return "started";
  if (RX.future.test(c) && RX.commitWord.test(c)) return "commitment";
  if (RX.ready.test(c)) return "reported_done";
  if (RX.starting.test(c) && !RX.future.test(c)) return "started";
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
      // "דירה 3: השירותים נוזלים" — the place is for this line only
      anchors++;
      current = [];
      const rest = line.slice(colon + 1).trim();
      if (rest) items.push({ text: rest, areas: headAreas });
      continue;
    }
    if (head) {
      // "גגות חדרי המדרגות: …" names its own subject: not the apartment above
      current = [];
      const rest = line.slice(colon + 1).trim();
      if (rest) items.push({ text: rest, areas: areasIn(rest, areas) });
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
  /** what the last messages of the chat were about */
  topic?: Topic | null;
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
    return unique(out);
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
  return unique(out);
}

/** The same line twice in a message is one update. */
function unique(events: ExtractedEvent[]): ExtractedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.type}|${e.areaIds.join()}|${e.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  // what the chat was just talking about fills in what this message leaves out ("דירה 8" … "סיימנו את הגבס")
  const topic = fresh(ctx.topic, ctx.sentAt);
  const inText = areasIn(main, facts.areas);
  const fromTopic = !inText.length && !listAreas && !!topic?.areaIds.length;
  // the work: said in words, or — when nobody is named — what the chat was about, or what the PM chose for a message like this
  const learned = !contractor && ctx.learner ? ctx.learner.tradeFor(main, type) : null;
  const ownTrade = tradeIn(main, facts.trades) ?? learned;
  const tradeOnly = ownTrade ?? (!contractor && topic && (fromTopic || inText.length === 0) ? topic.tradeId : null);
  const tradeKey = tradeOnly;
  const tradeId = tradeOnly ?? contractor?.trade_id ?? null;
  const areas = inText.length ? inText : listAreas ?? (fromTopic ? facts.areas.filter((a) => topic!.areaIds.includes(a.id)) : []);
  const except = rest ? areasIn(rest, facts.areas) : [];
  const all = RX.all.test(main) && areas.length === 0;
  const date = type === "commitment" ? dateFrom(clause, ctx.sentAt, ctx.timeZone) : null;
  // nothing to tie it to (no one, no trade, no place) → it is chatter, not an update
  if (!contractor && !tradeKey && !areas.length && !all) return null;
  // a date is someone's promise only when they said it, or were named ("מחר יגיעו…" to the chat partner is not);
  // the PM naming the trade and the place ("החשמלאי יגיע ביום ראשון לדירה 12") is as good as a name
  // so is a forwarded "נתחיל צבע בדירה 3" (the writer speaks for himself, we just do not know his name)
  const pinned = (speaker.role === "pm" || (speaker.role === null && RX.firstPerson.test(main))) && !!tradeKey && areas.length > 0;
  if (type === "commitment" && (!date || (!named.length && speaker.role !== "contractor" && !pinned))) return null;
  // a new task or a defect is only useful with a place
  if ((type === "new_task" || type === "defect") && !areas.length && !all) return null;

  let confidence = 0.55;
  if (areas.length || all) confidence += fromTopic ? 0.05 : 0.15;
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

/** The state a task is in when a place-only update ("דירה 6 מוכנה") is about it. */
const PLACE_ONLY: Partial<Record<EventType, Task["status"][]>> = {
  reported_done: ["in_progress"],
  started: ["ready"],
  inspected_ok: ["awaiting_approval"],
};

/**
 * Only a place, no one and no trade: in each place, the one task that is in
 * the state the update speaks of — or nothing when any place has several.
 */
function byPlaceOnly(e: ExtractedEvent, open: Task[], facts: ProjectFacts): Task[] {
  const states = PLACE_ONLY[e.type];
  if (!states || !e.areaIds.length) return [];
  const out: Task[] = [];
  for (const id of e.areaIds) {
    const inside = within(facts.areas, [id]);
    const here = open.filter((t) => t.area_id && inside.has(t.area_id) && states.includes(t.status));
    if (here.length !== 1) return [];
    out.push(here[0]);
  }
  return out;
}

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
  const excluded = within(facts.areas, e.exceptAreaIds);
  if (!e.contractorId && !e.tradeId) return byPlaceOnly(e, open, facts);

  if (e.areaIds.length) {
    const inside = within(facts.areas, e.areaIds);
    return open.filter((t) => t.area_id && inside.has(t.area_id) && !excluded.has(t.area_id));
  }
  if (e.all) return open.filter((t) => !t.area_id || !excluded.has(t.area_id));
  const active = open.filter((t) => t.status === "in_progress");
  return active.length === 1 ? active : [];
}

/**
 * When the message did not say which task: the open tasks the PM can choose
 * from — in the places it named (by the person or work, when known), or that
 * person's or work's open tasks. At most `max`; none when it named nothing.
 */
export function taskOptions(e: ExtractedEvent, facts: ProjectFacts, max = 40): Task[] {
  const closed = e.type === "inspected_ok" ? ["done"] : ["done", "awaiting_approval"];
  let open = facts.tasks.filter((t) => !closed.includes(t.status));
  if (e.type === "started") open = open.filter((t) => t.status === "planned" || t.status === "ready");
  if (e.areaIds.length) {
    const inside = within(facts.areas, e.areaIds);
    open = open.filter((t) => t.area_id && inside.has(t.area_id));
  } else if (!e.contractorId && !e.tradeId) return [];
  const who = e.contractorId ? open.filter((t) => t.contractor_id === e.contractorId) : [];
  const work = e.tradeId ? open.filter((t) => t.trade_id === e.tradeId) : [];
  // the person or the work narrows it, unless that leaves nothing (the name was wrong, the place is right)
  const narrowed = who.length ? who : work.length ? work : e.areaIds.length ? open : [];
  return narrowed.slice(0, max);
}

// ───────────────────────── reminders ─────────────────────────

const REMIND = /(?:^|\s)(?:תזכיר(?:ו)?(?:\s+לי)?|תזכורת|להזכיר(?:\s+לי)?|הזכר(?:\s+לי)?)(?=[\s:,–-]|$)[\s:,–-]*/;
const AT_HOUR = /(?:בשעה\s*|(?:^|\s)ב-?\s?)(\d{1,2})(?::(\d{2}))?(?![\d./])/;
const DATE_WORDS = /(מחרתיים|מחר|היום|בשבוע הבא|ביום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי)|ב-?\s?\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/g;

/**
 * "תזכיר לי מחר ב-8 לבדוק לחץ מים בדירה 9" → when (UTC) and what. Without a
 * time: 08:00; without a day: today if the hour is still ahead, else tomorrow.
 */
export function reminderFrom(text: string, sentAt: Date, timeZone: string): { dueAt: string; what: string } | null {
  const clean = normalize(text);
  if (!REMIND.test(clean)) return null;
  const day = dateFrom(clean, sentAt, timeZone);
  const hm = clean.match(AT_HOUR);
  let hour = hm ? Number(hm[1]) : 8;
  const minute = hm?.[2] ? Number(hm[2]) : 0;
  if (hour > 23 || minute > 59) hour = 8;
  let date = day;
  if (!date) {
    const today = localDay(sentAt, timeZone);
    const [y, m, d] = today.split("-").map(Number);
    const at = zonedToUtc(y, m, d, hour, minute, 0, timeZone);
    date = hm && at > sentAt ? today : addDays(today, 1);
  }
  const [y, m, d] = date.split("-").map(Number);
  const dueAt = zonedToUtc(y, m, d, hour, minute, 0, timeZone).toISOString();
  const what = clean
    .replace(REMIND, " ")
    .replace(DATE_WORDS, " ")
    .replace(AT_HOUR, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:–-]+|[\s,.:–-]+$/g, "")
    .trim();
  return { dueAt, what: what || clean };
}

// ───────────────────────── the chat's topic ─────────────────────────

/** How long a place said in the chat stays what the next messages are about. */
export const TOPIC_MS = 30 * 60_000;

export interface Topic {
  /** when the topic was last said (ms) */
  at: number;
  areaIds: string[];
  tradeId: string | null;
}

function fresh(topic: Topic | null | undefined, now: Date): Topic | null {
  return topic && now.getTime() - topic.at >= 0 && now.getTime() - topic.at <= TOPIC_MS ? topic : null;
}

/**
 * What the chat is about after this message: the place (and work) it names,
 * or — when it names none — what it was about before, if still fresh.
 */
export function nextTopic(topic: Topic | null, text: string, at: Date, facts: ProjectFacts): Topic | null {
  const clean = normalize(text.replace(RX.marker, " "));
  const areas = areasIn(clean, facts.areas);
  const tradeId = tradeIn(clean, facts.trades);
  const still = fresh(topic, at);
  if (areas.length) return { at: at.getTime(), areaIds: areas.map((a) => a.id), tradeId };
  if (tradeId && still) return { ...still, at: at.getTime(), tradeId };
  return still;
}
