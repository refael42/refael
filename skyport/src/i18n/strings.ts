/** Pure translation helpers (no React), usable from tests and scripts. */
import { en, type TKey } from './en';
import { he } from './he';

export type Lang = 'en' | 'he';
export const LANGS: readonly Lang[] = ['he', 'en'];

export const DICTS: Record<Lang, Record<TKey, string>> = { en, he };

export function isRTL(lang: Lang): boolean {
  return lang === 'he';
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'he';
}

/** Picks a supported language from a device language code like "he" or "en-US". */
export function pickLang(code: string | null | undefined): Lang {
  const c = (code ?? '').toLowerCase();
  if (c.startsWith('he') || c.startsWith('iw')) return 'he';
  return 'en';
}

export type TParams = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const dict = DICTS[lang] ?? en;
  let s = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
  }
  return s;
}

/** Placeholder names used in a string, sorted, e.g. "{n} of {t}" -> ["n", "t"]. */
export function placeholders(s: string): string[] {
  const out = new Set<string>();
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.add(m[1]);
  return [...out].sort();
}

export type { TKey };
