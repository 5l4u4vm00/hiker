import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';
import i18n, { resolveLanguage } from '@/i18n';

export type LanguagePreference = 'system' | 'en' | 'zh-Hant';

const STORAGE_KEY = 'language_preference';

interface LanguageState {
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  /** Loads the persisted preference from SQLite at startup. */
  hydrate: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    set({ preference });
    void setSetting(STORAGE_KEY, preference);
    void i18n.changeLanguage(resolveLanguage(preference));
  },
  hydrate: async () => {
    const stored = await getSetting(STORAGE_KEY);
    const preference: LanguagePreference =
      stored === 'system' || stored === 'en' || stored === 'zh-Hant' ? stored : 'system';
    set({ preference });
    await i18n.changeLanguage(resolveLanguage(preference));
  },
}));
