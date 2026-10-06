/** Hebrew text helpers shared by the heuristic parser and the resolver. */

/** One-letter prefixes that attach to Hebrew words: ו ב ל מ ה ש כ */
const PREFIX = "[ובלמהשכ]{0,2}";

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word match that tolerates Hebrew prefixes and refuses partial numbers. */
export function hasWord(text: string, word: string): boolean {
  if (!word) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${PREFIX}${escapeRe(word)}(?![\\p{L}\\p{N}])`, "u").test(text);
}

/** Like hasWord but allows a suffix (plural / construct state): "מרפסות" ≈ "מרפסת". */
export function hasStem(text: string, stem: string): boolean {
  if (!stem) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${PREFIX}${escapeRe(stem)}`, "u").test(text);
}

export function normalize(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, "") // niqqud
    .replace(/[–—]/g, "-")
    .replace(/["'״׳]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meaningful tokens (≥2 chars, no stop words). */
const STOP = new Set(["את", "של", "על", "עם", "אל", "גם", "כל", "זה", "זו", "הוא", "היא", "אני", "אנחנו", "יש", "אין", "לא", "כן", "מה", "מי"]);
export function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^[ובלמהשכ](?=\p{L}{3,})/u, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Token overlap (Jaccard-ish on the smaller side). */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w) || [...tb].some((x) => x.length >= 3 && w.length >= 3 && (x.startsWith(w) || w.startsWith(x)))) hit++;
  return hit / Math.min(ta.size, tb.size);
}
