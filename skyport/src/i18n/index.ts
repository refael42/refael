import { getLocales } from 'expo-localization';
import { useCallback } from 'react';

import { useSettings } from '../settings/store';
import { isRTL, pickLang, translate, type Lang, type TKey, type TParams } from './strings';

export { isRTL, pickLang, translate, LANGS } from './strings';
export type { Lang, TKey, TParams } from './strings';

/** Language of the device, mapped to a supported language. */
export function deviceLang(): Lang {
  try {
    const loc = getLocales()[0];
    return pickLang(loc?.languageCode ?? loc?.languageTag);
  } catch {
    return 'en';
  }
}

export function useLang(): Lang {
  return useSettings((s) => s.lang);
}

export function useT(): (key: TKey, params?: TParams) => string {
  const lang = useLang();
  return useCallback((key: TKey, params?: TParams) => translate(lang, key, params), [lang]);
}

/** Layout helpers for real RTL without restarting the app. */
export function useDir() {
  const rtl = isRTL(useLang());
  return {
    rtl,
    row: (rtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    textAlign: (rtl ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    start: rtl ? 'right' : 'left',
    end: rtl ? 'left' : 'right',
  };
}
