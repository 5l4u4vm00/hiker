import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';

const STORAGE_KEY = 'voice_enabled';

interface VoiceState {
  /** Whether spoken navigation guidance is enabled. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Flips the enabled flag; used by the in-map quick-mute control. */
  toggle: () => void;
  /** Loads the persisted preference from SQLite at startup. */
  hydrate: () => Promise<void>;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  enabled: true,
  setEnabled: (enabled) => {
    set({ enabled });
    void setSetting(STORAGE_KEY, String(enabled));
  },
  toggle: () => get().setEnabled(!get().enabled),
  hydrate: async () => {
    const stored = await getSetting(STORAGE_KEY);
    if (stored === 'true' || stored === 'false') {
      set({ enabled: stored === 'true' });
    }
  },
}));
