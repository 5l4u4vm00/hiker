import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';

const STORAGE_KEY = 'maptiler_token';

/**
 * Build-time MapTiler key from the `EXPO_PUBLIC_MAPTILER_KEY` env var, inlined
 * into the JS bundle. Used as a fallback when the user hasn't set their own token
 * in Settings. `EXPO_PUBLIC_*` vars are not secrets — they ship in the client, so
 * restrict the key by allowed origins / bundle id in the MapTiler dashboard.
 */
export const ENV_MAPTILER_TOKEN = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

/**
 * Resolves the effective MapTiler token: the user's override if they've entered
 * one in Settings, otherwise the build-time env token.
 */
export function resolveMapToken(token: string): string {
  return token.trim() || ENV_MAPTILER_TOKEN;
}

interface MapTokenState {
  /** User-entered token override; an empty string means "use the env fallback". */
  token: string;
  setToken: (token: string) => void;
  /** Loads the persisted token from SQLite at startup. */
  hydrate: () => Promise<void>;
}

export const useMapTokenStore = create<MapTokenState>((set) => ({
  token: '',
  setToken: (token) => {
    set({ token });
    void setSetting(STORAGE_KEY, token);
  },
  hydrate: async () => {
    const stored = await getSetting(STORAGE_KEY);
    if (stored != null) {
      set({ token: stored });
    }
  },
}));
