import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Loads the persisted preference from SQLite at startup. */
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => {
    set({ preference });
    void setSetting(STORAGE_KEY, preference);
  },
  hydrate: async () => {
    const stored = await getSetting(STORAGE_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      set({ preference: stored });
    }
  },
}));
