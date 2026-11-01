import { getLocales } from 'expo-localization';
import { useSettings } from '../store/settings';
import { ar } from './ar';
import { en, type TKey } from './en';
import { es } from './es';
import { he } from './he';
import { ru } from './ru';

export const LANGS = ['he', 'en', 'ar', 'ru', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export type { TKey };

/** Each language named in itself, for the language chips. */
export const LANG_LABEL: Record<Lang, string> = { he: 'עברית', en: 'English', ar: 'العربية', ru: 'Русский', es: 'Español' };

const DICTS: Record<Lang, Record<TKey, string>> = { en, he, ar, ru, es };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export const isRTL = (lang: Lang) => lang === 'he' || lang === 'ar';

/** The phone's first language when the game speaks it, else English. */
export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return isLang(code) ? code : 'en';
}

/** Data tables reference strings by key; unknown keys fall back to the key so gaps are visible. */
export function translate(lang: Lang, key: string): string {
  return (DICTS[lang] as Record<string, string>)[key] ?? key;
}

export function useT(): (key: TKey | string) => string {
  const lang = useSettings((s) => s.lang);
  return (key) => translate(lang, key);
}
