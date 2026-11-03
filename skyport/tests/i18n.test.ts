import { describe, expect, it } from 'vitest';

import { CITIES } from '../src/data/cities';
import { en } from '../src/i18n/en';
import { he } from '../src/i18n/he';
import { DICTS, pickLang, placeholders, translate, type TKey } from '../src/i18n/strings';

describe('translations', () => {
  const keys = Object.keys(en) as TKey[];

  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang} has every key with the same placeholders`, () => {
      for (const k of keys) {
        expect(dict[k], `${lang} missing ${k}`).toBeTypeOf('string');
        expect(dict[k].trim().length, `${lang} empty ${k}`).toBeGreaterThan(0);
        expect(placeholders(dict[k]), `${lang} placeholders of ${k}`).toEqual(placeholders(en[k]));
      }
      expect(Object.keys(dict).sort()).toEqual([...keys].sort());
    });
  }

  it('Hebrew strings are actually Hebrew (except brand/language names)', () => {
    const latinOk = new Set<TKey>(['lang.en', 'eff.mult']);
    for (const k of Object.keys(he) as TKey[]) {
      if (latinOk.has(k)) continue;
      expect(/[֐-׿]/.test(he[k]), `he ${k} = ${he[k]}`).toBe(true);
    }
  });

  it('every city has a name', () => {
    for (const c of CITIES) expect(en[`city.${c.id}` as TKey], c.id).toBeTypeOf('string');
  });

  it('keeps "from ← to" arrows right-to-left in Hebrew', () => {
    const s = translate('he', 'eff.mult', { a: 1, b: 1.25 });
    expect(s).toBe('\u200Fx1 \u200F\u2190\u200F x1.25');
    const n = translate('he', 'eff.counters', { a: 1, b: 2 });
    expect(n.startsWith('\u200F1 \u200F\u2190\u200F 2')).toBe(true);
    expect(translate('en', 'eff.mult', { a: 1, b: 1.25 })).not.toContain('\u200F');
  });

  it('substitutes parameters', () => {
    expect(translate('en', 'hud.day', { n: 3 })).toBe('Day 3');
    expect(translate('he', 'hud.day', { n: 3 })).toBe('יום 3');
  });

  it('maps device languages', () => {
    expect(pickLang('he-IL')).toBe('he');
    expect(pickLang('iw')).toBe('he');
    expect(pickLang('en-US')).toBe('en');
    expect(pickLang('fr')).toBe('en');
    expect(pickLang(null)).toBe('en');
  });
});
