/**
 * Learning from the PM's own decisions — free, local, no AI.
 *
 * Every approved, dismissed or hand-marked update is an example. A new
 * sentence that reads like one the PM dismissed (for the same kind of update)
 * is dropped; a sentence the rules missed but that reads like one the PM
 * approved or marked by hand is proposed with that example's kind.
 * "Reads like" = the share of meaningful words they have in common
 * (apartment numbers and filler words left out, so "דירה 14" ~ "דירה 15").
 *
 * Two more lessons: when the PM picked the tasks by hand, the work they are
 * (their trade) is what a similar message is about next time; and when the
 * PM undid something the system did by itself, a similar message waits for
 * approval instead of being acted on.
 */
import type { EventType } from "../db/types";

export interface Example {
  id: string;
  type: EventType;
  text: string;
  /** approved or marked by hand → true; dismissed → false */
  positive: boolean;
  /** the trade of the tasks the PM chose for it, when the words did not say */
  tradeId?: string | null;
  /** done by itself and then undone by the PM */
  undone?: boolean;
  /** when it was decided (ISO) */
  at?: string;
}

const STOP = new Set(
  "את של על עם זה זו זאת לי לך לו לה לנו לכם גם כל אני אתה את הוא היא אנחנו הם יש בבקשה טוב בוקר ערב תודה אחי עוד רק כבר אז אם או כי מה מי שלום יום היום".split(" "),
);
const PREFIX = /^[והבלמשכ]/;

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.replace(/[^\p{L}\s]/gu, " ").split(/\s+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    // one leading particle off ("בדירה" → "דירה", "והחשמל" → "החשמל" → kept as is after one cut)
    const w = raw.length > 3 && PREFIX.test(raw) ? raw.slice(1) : raw;
    if (!STOP.has(w)) out.add(w);
  }
  return out;
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / Math.sqrt(a.size * b.size);
}

const VETO = 0.6;
const GUESS = 0.55;
const TRADE = 0.6;
const MIN_WORDS = 3;

export class Learner {
  private ex: Array<Example & { words: Set<string> }>;

  constructor(examples: Example[]) {
    this.ex = examples.map((e) => ({ ...e, words: tokens(e.text) })).filter((e) => e.words.size >= 2);
  }

  get size() {
    return this.ex.length;
  }

  private best(words: Set<string>, type: EventType | null, positive: boolean, only?: (e: Example) => boolean) {
    let top: { sim: number; ex: Example } | null = null;
    for (const e of this.ex) {
      if (e.undone && !only) continue;
      if (only && !only(e)) continue;
      if (e.positive !== positive || (type && e.type !== type)) continue;
      const sim = similarity(words, e.words);
      if (!top || sim > top.sim) top = { sim, ex: e };
    }
    return top;
  }

  /** The PM dismissed something just like this, as this kind of update. */
  vetoes(text: string, type: EventType): boolean {
    const words = tokens(text);
    const no = this.best(words, type, false);
    if (!no || no.sim < VETO) return false;
    const yes = this.best(words, type, true);
    return !yes || yes.sim <= no.sim;
  }

  /** The trade the PM chose for a message just like this one. */
  tradeFor(text: string, type: EventType): string | null {
    const words = tokens(text);
    if (words.size < 2) return null;
    const yes = this.best(words, type, true, (e) => !!e.tradeId);
    return yes && yes.sim >= TRADE ? yes.ex.tradeId! : null;
  }

  /** The PM undid this kind of update for a message just like this: ask first, do not act. */
  cautious(text: string, type: EventType): boolean {
    const words = tokens(text);
    const undone = this.best(words, type, false, (e) => !!e.undone);
    if (!undone || undone.sim < VETO) return false;
    // approving one like it after the undo ends the caution
    const later = this.best(words, type, true, (e) => !!e.at && !!undone.ex.at && e.at > undone.ex.at);
    return !later || later.sim < VETO;
  }

  /** The rules found nothing, but the PM approved or marked something just like this. */
  guess(text: string): { type: EventType; similarity: number; exampleId: string } | null {
    const words = tokens(text);
    if (words.size < MIN_WORDS) return null;
    const yes = this.best(words, null, true);
    if (!yes || yes.sim < GUESS) return null;
    if (this.vetoes(text, yes.ex.type)) return null;
    return { type: yes.ex.type, similarity: yes.sim, exampleId: yes.ex.id };
  }
}
