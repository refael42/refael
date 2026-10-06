/**
 * Deterministic local parser for Hebrew site chat. Used when no
 * ANTHROPIC_API_KEY is configured (and as a fallback if the API call fails),
 * so suggestion cards work out of the box. It returns the same strict JSON
 * contract as Claude. Deliberately conservative: when unsure → intent "none".
 */
import type { Area, Contractor, Task, Trade } from "../db/types";
import { areaLabel } from "../services/snapshot";
import type { ParseContext } from "./context";
import type { ParsedMessage } from "./schema";
import { hasWord, normalize } from "./text";

const RX = {
  completion: /(^|\s)(סיימתי|סיימנו|סיים|גמרתי|גמרנו|גמרו|הסתיים|הסתיימה|הושלם|הושלמה|בוצע|בוצעה|מוכן לבדיקה|מוכנה לבדיקה|done|finished)(?=\s|$|[.,!])/i,
  blocker: /(אי אפשר|אי-אפשר|לא ניתן|לא יכול|לא יכולים|אין (לי |לנו )?|חסר|חסרה|חסרים|תקוע|תקועים|נתקענו|מחכה ל|מחכים ל|ממתין ל|ממתינים ל|בעיה ב|עצירה)/,
  decision: /(החלטנו|הוחלט|סוכם|סגרנו ש|מאשר ש|אושר ש|מעכשיו)/,
  question: /\?\s*$|^(מתי|למה|איך|מה |האם|כמה|איפה|מי )/,
  newTask: /(צריך|צריכה|צריכים|יש ל|חייב|חייבים|תבצע|תעשה|תתקין|תסמן|תצוק|תבדוק|נא ל|לבצע|להזמין|לסמן|לצקת|להתקין|לבנות|לסגור|לתקן|לבדוק|לאטום|לפרק|להחליף|לחפות|לרצף|מתחילים|מתחיל|נתחיל)/,
  startsNow: /(מתחילים היום|מתחיל היום|התחלנו|התחלתי|כבר עובד|עובדים על זה|מתחילים עכשיו|היום מתחילים)/,
  chain: /\s*(?:,\s*)?(?:ואז|ולאחר מכן|לאחר מכן|אחר כך|אחרי זה|ואחרי זה|ובסוף|ובהמשך)\s+/,
  invite: /^(?:ל|ו)?(?:הזמין|להזמין|תזמין|לקרוא ל|לתאם עם|להביא את)\s+(?:את\s+)?(\S+)/,
  enables: /^(?:אפשר|ניתן|יהיה אפשר|נוכל)\s+(?:ל)?(\S+)/,
};

/** Infinitive → construct-state noun for task titles ("לסמן את החורים" → "סימון החורים"). */
const NOUN: Record<string, string> = {
  לצקת: "יציקת",
  לסמן: "סימון",
  להתקין: "התקנת",
  לבנות: "בניית",
  לסגור: "סגירת",
  לתקן: "תיקון",
  לבדוק: "בדיקת",
  לאטום: "איטום",
  לצבוע: "צביעת",
  לפרק: "פירוק",
  להחליף: "החלפת",
  לחפות: "חיפוי",
  לרצף: "ריצוף",
  לטייח: "טיח",
  להעביר: "העברת",
  לנקות: "ניקוי",
  לחבר: "חיבור",
  לקדוח: "קידוח",
  לשפץ: "שיפוץ",
  לפנות: "פינוי",
  להזמין: "הזמנת",
  להרכיב: "הרכבת",
  לגבס: "גבס",
  לשים: "התקנת",
  // imperatives ("תבדוק את…")
  תבדוק: "בדיקת",
  תסמן: "סימון",
  תתקין: "התקנת",
  תצוק: "יציקת",
  תסגור: "סגירת",
  תתקן: "תיקון",
  תבנה: "בניית",
  תפרק: "פירוק",
  תחליף: "החלפת",
  תאטום: "איטום",
};

/** Trade keywords (stems) → trade key. */
const TRADE_WORDS: Array<[RegExp, string]> = [
  [/(חשמל|תשתיות חשמל|לוח חשמל)/, "electrical"],
  [/(אינסטלציה|אינסטלטור|בדיקת לחץ|צנרת מים|ביוב)/, "plumbing"],
  [/(מיזוג|מזגן|VRF)/i, "hvac"],
  [/(גבס|תקרה אקוסטית)/, "drywall"],
  [/(טיח|לטייח|טייח)/, "plaster"],
  [/(צבע|לצבוע|צביעה)/, "paint"],
  [/(איטום|לאטום)/, "waterproofing"],
  [/(ריצוף|אריחים|קרמיקה|לרצף)/, "tiling"],
  [/(אלומיניום|חלונות|חלון)/, "aluminum"],
  [/(מסגר|מעקה|מעקות|סימון חורים|דלתות אש)/, "metalwork"],
  [/(חיפוי|לחפות)/, "cladding"],
  [/(בטון|יציקה|לצקת|קורה|קורת|שלד|בלוקים|תבנית)/, "structure"],
  [/(גינון|פיתוח שטח|השקיה)/, "landscaping"],
  [/(ספרינקלר|גילוי אש|כיבוי אש|בטיחות אש)/, "fire"],
];

function wordVariants(word: string): string[] {
  const out = new Set([word]);
  if (word.endsWith("ות")) out.add(word.slice(0, -2) + "ת");
  if (word.endsWith("ים")) out.add(word.slice(0, -2));
  if (word.endsWith("ה")) out.add(word.slice(0, -1) + "ות");
  if (word.endsWith("ת")) out.add(word.slice(0, -1) + "ות");
  return [...out];
}

/** The most specific area mentioned in the text (apartment > floor > room/common). */
export function findArea(text: string, areas: Area[]): Area | null {
  const t = normalize(text);
  const rank: Record<string, number> = { apartment: 0, room: 1, floor: 2, common: 3, building: 4 };
  const hits = areas.filter((a) => {
    const name = normalize(a.name);
    if (/\d/.test(name)) return hasWord(t, name);
    if (a.type === "room") return false; // room names (סלון) are too generic without an apartment
    const parts = name.split(/[\s-]+/).filter(Boolean);
    const words = parts.filter((w) => (w.length >= 3 || parts.length === 1) && !["חדר", "חזית"].includes(w));
    return words.some((w) => wordVariants(w).some((v) => hasWord(t, v)));
  });
  hits.sort((a, b) => rank[a.type] - rank[b.type]);
  return hits[0] ?? null;
}

export function findContractors(text: string, contractors: Contractor[]): Contractor[] {
  const t = normalize(text);
  return contractors
    .map((c) => ({ c, i: t.search(new RegExp(`(^|[^\\p{L}])[ולבמהש]?${normalize(c.name)}(?![\\p{L}])`, "u")) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c);
}

export function findTradeKey(text: string): string | null {
  for (const [rx, key] of TRADE_WORDS) if (rx.test(text)) return key;
  return null;
}

function titleFrom(step: string, areaName: string | null, contractorNames: string[]): string {
  let s = normalize(step);
  // drop a leading vocative "שור," and filler
  for (const n of contractorNames) s = s.replace(new RegExp(`^${n}\\s*,?\\s*`), "");
  s = s.replace(/^(?:ו)?(?:צריך|צריכה|צריכים|יש|חייב|חייבים|נא|בבקשה|תדאג)\s+/, "").replace(/\s+בבקשה(?=\s)/, "");
  s = s.split(/\s+(?:ותעדכן|ותגיד|ותשלח|ותודיע|ותחזור)/)[0];
  s = s.split(/[.!?\n]| ,|,(?=\s*(?:מתחיל|מתחילים|כי|ואז|ייבוש|זה))/)[0].trim();
  const [first, ...rest] = s.split(" ");
  const noun = NOUN[first];
  if (noun) {
    s = [noun, ...rest].join(" ").replace(new RegExp(`^${noun} את `), `${noun} `);
  }
  s = s.replace(/\s+של\s+ה/g, " ה").replace(/\s{2,}/g, " ").trim();
  // move the area to the " – area" suffix used by task titles
  if (areaName && hasWord(s, areaName)) {
    s = s.replace(new RegExp(`\\s*[ובלמהשכ]{0,2}${areaName}`), "").trim();
    s = `${s} – ${areaName}`;
  }
  return s.length > 90 ? `${s.slice(0, 87)}…` : s;
}

function checkInDays(text: string, startsNow: boolean): number | null {
  const m = text.match(/(\d+)\s*ימים/);
  if (m) return Number(m[1]);
  if (/יומיים/.test(text)) return 2;
  if (/שלושה ימים|3 ימים/.test(text)) return 3;
  if (/מחר/.test(text)) return 1;
  if (/שבוע/.test(text)) return 7;
  return startsNow ? 2 : null;
}

/** Open tasks of `tradeKey` in (or containing / contained by) `area`. */
function tasksOfTradeIn(ctx: ParseContext, tradeId: string | null, areaId: string | null, mode: "overlap" | "within" = "overlap"): Task[] {
  if (!tradeId) return [];
  const areaById = new Map(ctx.areas.map((a) => [a.id, a]));
  const chain = (id: string | null) => {
    const out: string[] = [];
    for (let cur = id ? areaById.get(id) : undefined; cur; cur = cur.parent_id ? areaById.get(cur.parent_id) : undefined) out.push(cur.id);
    return out;
  };
  const up = chain(areaId);
  return ctx.tasks.filter(
    (t) => t.trade_id === tradeId && (!areaId || chain(t.area_id).includes(areaId) || (mode === "overlap" && up.includes(t.area_id ?? ""))),
  );
}

function tradeId(trades: Trade[], key: string | null) {
  return key ? trades.find((t) => t.key === key)?.id ?? null : null;
}

export function heuristicParse(rawText: string, ctx: ParseContext): ParsedMessage {
  const text = normalize(rawText);
  const none: ParsedMessage = { intent: "none", tasks: [], affects: [], completes_task_id: null, blocker_text: null, confidence: 0.6 };
  if (text.length < 4) return none;

  const area = findArea(text, ctx.areas);
  const areaName = area ? area.name : null;
  const mentioned = findContractors(text, ctx.contractors);
  const senderContractor = ctx.contractors.find((c) => c.id === ctx.sender.contractorId) ?? null;
  const addressee =
    ctx.sender.role === "pm" ? ctx.contractors.find((c) => ctx.addressees.some((a) => a.contractorId === c.id)) ?? null : null;
  const tradeKey = findTradeKey(text);
  const areaById = new Map(ctx.areas.map((a) => [a.id, a]));
  const isQuestion = RX.question.test(text);

  // ── completion report ──
  if (RX.completion.test(text) && !isQuestion) {
    const who = senderContractor ?? mentioned[0] ?? addressee;
    let candidates = ctx.tasks.filter((t) => t.status !== "done" && (!who || t.contractor_id === who.id));
    if (area) {
      const inArea = candidates.filter((t) => t.area_id === area.id || areaById.get(t.area_id ?? "")?.parent_id === area.id);
      if (inArea.length) candidates = inArea;
      else candidates = [];
    }
    const tid = tradeId(ctx.trades, tradeKey);
    if (tid && candidates.some((t) => t.trade_id === tid)) candidates = candidates.filter((t) => t.trade_id === tid);
    const inProgress = candidates.filter((t) => t.status === "in_progress");
    const pick = candidates.length === 1 ? candidates[0] : inProgress.length === 1 ? inProgress[0] : null;
    const affects = pick ? successorsTitles(ctx, pick) : [];
    return { ...none, intent: "completion_report", completes_task_id: pick?.id ?? null, affects, confidence: pick ? 0.8 : 0.5 };
  }

  // ── blocker ──
  if (RX.blocker.test(text) && !RX.newTask.test(text.replace(RX.blocker, ""))) {
    const m = text.match(/(?:,|כי|בגלל ש?|מאחר ש)\s*(.+)$/);
    const blockerText = (m?.[1] ?? text.replace(/^(אי אפשר|לא ניתן)[^,]*,?\s*/, "")).replace(/[.!]+$/, "").trim();
    // the blocked work: the clause before the reason, else the sender's own trade
    const head = m ? text.slice(0, text.indexOf(m[0])) : text;
    const headArea = findArea(head, ctx.areas) ?? area;
    const tid = tradeId(ctx.trades, findTradeKey(head) ?? ctx.trades.find((t) => t.id === senderContractor?.trade_id)?.key ?? tradeKey);
    const affected = tasksOfTradeIn(ctx, tid, headArea?.id ?? null, "within").filter((t) => t.status !== "done");
    return { ...none, intent: "blocker", blocker_text: blockerText || text, affects: affected.slice(0, 5).map((t) => t.title), confidence: 0.75 };
  }

  if (RX.decision.test(text)) return { ...none, intent: "decision", confidence: 0.7 };
  if (isQuestion && (!RX.newTask.test(text) || /^(מתי|למה|איך|האם|כמה|איפה|מי )/.test(text))) return { ...none, intent: "question", confidence: 0.75 };

  // ── new task(s), possibly a chain ──
  if (!RX.newTask.test(text)) return none;
  const steps = text.split(RX.chain).map((s) => s.trim()).filter(Boolean);
  const startsNow = RX.startsNow.test(text);
  const tasks: ParsedMessage["tasks"] = [];
  const enabledTrades: string[] = [];
  let lastContractor: Contractor | null = null;

  for (const step of steps) {
    const enables = step.match(RX.enables);
    if (enables) {
      const k = findTradeKey(enables[1]) ?? findTradeKey(step);
      if (k) enabledTrades.push(k);
      continue;
    }
    const invite = step.match(RX.invite);
    if (invite) {
      const c = findContractors(invite[1], ctx.contractors)[0];
      if (c) {
        const trade = ctx.trades.find((t) => t.id === c.trade_id);
        const prev = tasks.at(-1);
        const stepArea = findArea(step, ctx.areas) ?? area;
        tasks.push({
          title: `${trade?.name ?? c.name}${stepArea ? ` – ${stepArea.name}` : ""}`,
          area: stepArea ? areaLabel(areaById, stepArea.id) : null,
          contractor: c.name,
          trade: trade?.name ?? null,
          status: "planned",
          check_in_days: null,
          depends_on_index: prev ? tasks.length - 1 : null,
        });
        lastContractor = c;
        continue;
      }
    }
    if (!RX.newTask.test(step) && tasks.length) continue;
    const stepContractors = findContractors(step, ctx.contractors);
    const who: Contractor | null =
      stepContractors[0] ?? (tasks.length === 0 ? addressee ?? (ctx.sender.role === "contractor" ? senderContractor : null) : lastContractor);
    const stepArea = findArea(step, ctx.areas) ?? area;
    const key = findTradeKey(step) ?? ctx.trades.find((t) => t.id === who?.trade_id)?.key ?? null;
    const trade = ctx.trades.find((t) => t.key === key) ?? null;
    tasks.push({
      title: titleFrom(step, stepArea?.name ?? null, ctx.contractors.map((c) => c.name)),
      area: stepArea ? areaLabel(areaById, stepArea.id) : null,
      contractor: who?.name ?? null,
      trade: trade?.name ?? null,
      status: tasks.length === 0 && startsNow ? "in_progress" : "planned",
      check_in_days: checkInDays(step, tasks.length === 0 && startsNow) ?? (tasks.length === 0 ? checkInDays(text, startsNow) : null),
      depends_on_index: tasks.length ? tasks.length - 1 : null,
    });
    lastContractor = who ?? lastContractor;
  }
  if (!tasks.length) return none;

  // affects: explicitly enabled trades in the area, else what the rules say follows the last step
  const last = tasks.at(-1)!;
  const lastArea = area ? area.id : null;
  const affects = new Set<string>();
  for (const k of enabledTrades) for (const t of tasksOfTradeIn(ctx, tradeId(ctx.trades, k), lastArea)) affects.add(t.title);
  if (!affects.size && lastArea) {
    const lastTradeId = ctx.trades.find((t) => t.name === last.trade)?.id ?? null;
    for (const r of ctx.rules.filter((r) => r.active && r.predecessor_trade_id === lastTradeId)) {
      for (const t of tasksOfTradeIn(ctx, r.successor_trade_id, lastArea)) {
        if (r.successor_keyword && !t.title.includes(r.successor_keyword)) continue;
        if (t.status !== "done") affects.add(t.title);
      }
    }
  }
  return {
    intent: "new_task",
    tasks,
    affects: [...affects].slice(0, 5),
    completes_task_id: null,
    blocker_text: null,
    confidence: tasks.every((t) => t.contractor && t.area) ? 0.8 : 0.6,
  };
}

function successorsTitles(ctx: ParseContext, task: Task): string[] {
  const out: string[] = [];
  for (const r of ctx.rules.filter((r) => r.active && r.predecessor_trade_id === task.trade_id)) {
    for (const t of tasksOfTradeIn(ctx, r.successor_trade_id, task.area_id)) if (t.id !== task.id) out.push(t.title);
  }
  return [...new Set(out)].slice(0, 5);
}

