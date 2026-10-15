/**
 * What a plan is, from the text in its PDF — free, local.
 *
 * Title blocks say the discipline ("תוכנית חשמל"), the sheet ("גיליון A-101")
 * and the revision ("מהדורה ג"); the drawing names its apartments and floors.
 * CAD exports often store Hebrew in visual order ("הריד 12" for "דירה 12"),
 * so every reading is done on the text as is and with Hebrew words flipped.
 */
import type { Area, PlanDiscipline } from "../db/types";
import { areasIn } from "../intel/extract";

const DISCIPLINES: Array<[PlanDiscipline, RegExp]> = [
  ["architecture", /(אדריכל|אדריכלות|אדריכלית|ארכיטקט|architect)/gi],
  ["structure", /(קונסטרוקצי|שלד|זיון|ברזל|רפסודה|כלונסא|structur)/gi],
  ["electrical", /(חשמל|תאורה|לוח חשמל|electric|lighting)/gi],
  ["plumbing", /(אינסטלציה|סניטרי|ביוב|ניקוז|מים חמים|plumbing|sanitary|drainage)/gi],
  ["hvac", /(מיזוג|אוורור|מזגנים|hvac|ventilation)/gi],
  ["fire", /(כיבוי אש|ספרינקלר|גילוי אש|בטיחות אש|fire|sprinkler)/gi],
  ["landscape", /(פיתוח|גינון|נוף|landscape)/gi],
];

const HEB = /[֐-׿]/;

/** Hebrew words flipped back to reading order, and each line's words in reverse order. */
export function readingOrder(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .split(/\s+/)
        .reverse()
        .map((w) => (HEB.test(w) ? [...w].reverse().join("") : w))
        .join(" "),
    )
    .join("\n");
}

function both(text: string): string {
  return `${text}\n${readingOrder(text)}`;
}

export function disciplineOf(text: string): PlanDiscipline | null {
  let best: PlanDiscipline | null = null;
  let top = 0;
  for (const [d, rx] of DISCIPLINES) {
    const n = (text.match(rx) ?? []).length;
    if (n > top) [best, top] = [d, n];
  }
  return best;
}

const SHEET = /(?:גיליון|גליון|מס['׳]?\s*תוכנית|מספר תוכנית|sheet|dwg\.?\s*no\.?)\s*[:.#-]?\s*([A-Za-z]{0,3}[-.]?\d{1,4}(?:[.-]\d{1,3})?)/i;
const REVISION = /(?:מהדורה|גרסה|גירסה|rev(?:ision)?\.?)\s*[:.#-]?\s*([A-Za-z0-9א-ת]{1,3})(?![A-Za-z0-9א-ת])/i;

export interface PlanReading {
  discipline: PlanDiscipline | null;
  sheet: string | null;
  revision: string | null;
  areaIds: string[];
}

/** Read discipline, sheet, revision and covered areas from the plan's text (and its title). */
export function analyzePlanText(text: string, title: string, areas: Area[]): PlanReading {
  const all = both(`${title}\n${text}`);
  return {
    discipline: disciplineOf(all),
    sheet: SHEET.exec(all)?.[1]?.toUpperCase() ?? null,
    revision: REVISION.exec(all)?.[1] ?? null,
    areaIds: areasIn(all, areas).map((a) => a.id),
  };
}

/** Words that appear in one version's text and not in the other's (labels, sizes, room names). */
export function textChanges(before: string | null, after: string | null, limit = 40): { added: string[]; removed: string[] } {
  const words = (t: string | null) => {
    const out = new Map<string, number>();
    for (const w of both(t ?? "").split(/\s+/)) {
      const k = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (k.length >= 2) out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  };
  const a = words(before);
  const b = words(after);
  const added = [...b.keys()].filter((w) => !a.has(w));
  const removed = [...a.keys()].filter((w) => !b.has(w));
  // the flipped copies of Hebrew words always differ — drop a word when its flip is on the other side
  const flip = (w: string) => [...w].reverse().join("");
  return {
    added: added.filter((w) => !(HEB.test(w) && a.has(flip(w)))).slice(0, limit),
    removed: removed.filter((w) => !(HEB.test(w) && b.has(flip(w)))).slice(0, limit),
  };
}
