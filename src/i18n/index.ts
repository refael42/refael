import { getLocales } from 'expo-localization';
import { useSettings } from '../store/settings';
import { en, type TKey } from './en';
import { he } from './he';

export type Lang = 'he' | 'en';
export type { TKey };

const DICTS: Record<Lang, Record<TKey, string>> = { en, he };

export const isRTL = (lang: Lang) => lang === 'he';

export function deviceLang(): Lang {
  return getLocales()[0]?.languageCode === 'he' ? 'he' : 'en';
}

/** Data tables reference strings by key; unknown keys fall back to the key so gaps are visible. */
export function translate(lang: Lang, key: string): string {
  return (DICTS[lang] as Record<string, string>)[key] ?? key;
}

export function useT(): (key: TKey | string) => string {
  const lang = useSettings((s) => s.lang);
  return (key) => translate(lang, key);
}
