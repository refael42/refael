import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ru' }] }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

const { en } = await import('../src/i18n/en');
const { he } = await import('../src/i18n/he');
const { ar } = await import('../src/i18n/ar');
const { ru } = await import('../src/i18n/ru');
const { es } = await import('../src/i18n/es');
const { deviceLang, isRTL, LANGS, LANG_LABEL, translate } = await import('../src/i18n');
const { NAMES, nameIn } = await import('../src/data/names');
const { RESTAURANT_NAMES } = await import('../src/data/tutorial');

const holes = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(' ');
const DICTS = { he, ar, ru, es } as const;

describe('languages', () => {
  it('every language has every key, filled in, with the same placeholders as English', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      const d = dict as Record<string, string>;
      expect(Object.keys(d).sort(), lang).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(en)) {
        expect(d[k]!.trim().length, `${lang} ${k}`).toBeGreaterThan(0);
        expect(holes(d[k]!), `${lang} ${k}`).toBe(holes(v));
      }
    }
  });

  it('the new languages are really translated, not copies of English', () => {
    for (const lang of ['ar', 'ru', 'es'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      const long = Object.keys(en).filter((k) => en[k as keyof typeof en].length > 30);
      const same = long.filter((k) => d[k] === en[k as keyof typeof en]);
      expect(same, lang).toEqual([]);
    }
    // The scripts are right too.
    expect(translate('ar', 'ui.settings')).toMatch(/[؀-ۿ]/);
    expect(translate('ru', 'ui.settings')).toMatch(/[Ѐ-ӿ]/);
  });

  it('picks the phone language, knows the right-to-left ones and names each language in itself', () => {
    expect(deviceLang()).toBe('ru');
    expect(LANGS.filter(isRTL)).toEqual(['he', 'ar']);
    expect(Object.keys(LANG_LABEL).sort()).toEqual([...LANGS].sort());
  });

  it('people and restaurants have names in every language', () => {
    for (const lang of LANGS) {
      for (const n of NAMES) expect(nameIn(n, lang).length).toBeGreaterThan(0);
      expect(RESTAURANT_NAMES[lang].length).toBe(RESTAURANT_NAMES.en.length);
    }
    expect(nameIn(NAMES[0]!, 'es')).toBe(NAMES[0]!.en);
  });
});
