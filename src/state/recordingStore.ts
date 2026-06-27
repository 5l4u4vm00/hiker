import { create } from 'zustand';

import type { ComputedStats } from '@/tracking/stats';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

const EMPTY_STATS: ComputedStats = {
  distanceM: 0,
  ascentM: 0,
  descentM: 0,
  maxAlt: null,
  durationS: 0,
  movingTimeS: 0,
  maxSpeed: null,
};

/** Last-point-derived live values for the recording HUD. */
export interface LiveSample {
  /** Current altitude (m). */
  altM: number | null;
  /** Current instantaneous speed (m/s). */
  speedMps: number | null;
  /** GPS horizontal accuracy (m). */
  accuracyM: number | null;
  lat: number | null;
  lon: number | null;
  recordedAt: number | null;
  /** Latest weather snapshot temperature (°C), if fetched. */
  weatherTempC: number | null;
  /** Latest weather WMO code, if fetched. */
  weatherCode: number | null;
}

const EMPTY_LIVE: LiveSample = {
  altM: null,
  speedMps: null,
  accuracyM: null,
  lat: null,
  lon: null,
  recordedAt: null,
  weatherTempC: null,
  weatherCode: null,
};

interface RecordingState {
  trackId: string | null;
  status: RecordingStatus;
  startedAt: number | null;
  /** Live stats recomputed from persisted points while recording. */
  stats: ComputedStats;
  /** Live values derived from the latest point and the weather fetch. */
  live: LiveSample;
  begin: (trackId: string, startedAt: number) => void;
  setStatus: (status: RecordingStatus) => void;
  setStats: (stats: ComputedStats) => void;
  setLive: (live: Partial<LiveSample>) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  trackId: null,
  status: 'idle',
  startedAt: null,
  stats: EMPTY_STATS,
  live: EMPTY_LIVE,
  begin: (trackId, startedAt) =>
    set({ trackId, startedAt, status: 'recording', stats: EMPTY_STATS, live: EMPTY_LIVE }),
  setStatus: (status) => set({ status }),
  setStats: (stats) => set({ stats }),
  setLive: (live) => set((state) => ({ live: { ...state.live, ...live } })),
  reset: () =>
    set({ trackId: null, status: 'idle', startedAt: null, stats: EMPTY_STATS, live: EMPTY_LIVE }),
}));
