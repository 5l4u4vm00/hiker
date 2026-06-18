import { create } from 'zustand';

import type { ComputedStats } from '@/tracking/stats';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

const EMPTY_STATS: ComputedStats = {
  distanceM: 0,
  ascentM: 0,
  descentM: 0,
  maxAlt: null,
  durationS: 0,
};

interface RecordingState {
  trackId: string | null;
  status: RecordingStatus;
  startedAt: number | null;
  /** Live stats recomputed from persisted points while recording. */
  stats: ComputedStats;
  begin: (trackId: string, startedAt: number) => void;
  setStatus: (status: RecordingStatus) => void;
  setStats: (stats: ComputedStats) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  trackId: null,
  status: 'idle',
  startedAt: null,
  stats: EMPTY_STATS,
  begin: (trackId, startedAt) => set({ trackId, startedAt, status: 'recording', stats: EMPTY_STATS }),
  setStatus: (status) => set({ status }),
  setStats: (stats) => set({ stats }),
  reset: () => set({ trackId: null, status: 'idle', startedAt: null, stats: EMPTY_STATS }),
}));
