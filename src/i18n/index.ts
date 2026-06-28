import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhHant from './locales/zh-Hant.json';

/** Concrete locales the app ships translations for. */
export type AppLanguage = 'en' | 'zh-Hant';

export const resources = {
  en: { translation: en },
  'zh-Hant': { translation: zhHant },
} as const;

/**
 * Resolves a language preference to a concrete app locale. `'system'` inspects
 * the device's preferred locales and uses Traditional Chinese only for explicit
 * Traditional tags (zh-Hant / zh-TW / zh-HK / zh-MO); everything else falls back
 * to English.
 */
export function resolveLanguage(
  preference: 'system' | AppLanguage,
  locales: Localization.Locale[] = Localization.getLocales(),
): AppLanguage {
  if (preference === 'en' || preference === 'zh-Hant') return preference;
  const top = locales[0];
  const tag = (top?.languageTag ?? '').toLowerCase();
  const isTraditional =
    top?.languageScriptCode === 'Hant' || /hant|-tw|-hk|-mo/.test(tag);
  return isTraditional ? 'zh-Hant' : 'en';
}

// Initialize synchronously at import time: resources are bundled (no async
// backend), so the instance is ready before the first render. The default
// language follows the device; a persisted preference is applied at startup.
// eslint-disable-next-line import/no-named-as-default-member -- `i18n.use` is the standard i18next builder API.
i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage('system'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
