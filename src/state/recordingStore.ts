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
  /**
   * Wall-clock ms when the recording was paused, or null while it is running.
   * Used to freeze the elapsed timer during a pause.
   */
  pausedAt: number | null;
  /** Total ms spent paused so far, accumulated across pause/resume cycles. */
  pausedMs: number;
  /** Live stats recomputed from persisted points while recording. */
  stats: ComputedStats;
  /** Live values derived from the latest point and the weather fetch. */
  live: LiveSample;
  begin: (trackId: string, startedAt: number) => void;
  pause: () => void;
  resume: () => void;
  setStats: (stats: ComputedStats) => void;
  setLive: (live: Partial<LiveSample>) => void;
  reset: () => void;
}

/**
 * Active recording duration in ms: wall-clock time since `startedAt`, minus all
 * accumulated paused time. While paused, time is measured up to `pausedAt` so
 * the value freezes instead of advancing. This is the single source of truth for
 * the elapsed timer — independent of GPS point timestamps, which can lag the
 * real start (first-fix delay) or be absent entirely.
 */
export function activeElapsedMs(state: {
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
}): number {
  if (state.startedAt == null) return 0;
  const end = state.pausedAt ?? Date.now();
  return Math.max(0, end - state.startedAt - state.pausedMs);
}

export const useRecordingStore = create<RecordingState>((set) => ({
  trackId: null,
  status: 'idle',
  startedAt: null,
  pausedAt: null,
  pausedMs: 0,
  stats: EMPTY_STATS,
  live: EMPTY_LIVE,
  begin: (trackId, startedAt) =>
    set({
      trackId,
      startedAt,
      pausedAt: null,
      pausedMs: 0,
      status: 'recording',
      stats: EMPTY_STATS,
      live: EMPTY_LIVE,
    }),
  pause: () => set((state) => (state.pausedAt ? state : { status: 'paused', pausedAt: Date.now() })),
  resume: () =>
    set((state) => ({
      status: 'recording',
      pausedAt: null,
      pausedMs: state.pausedMs + (state.pausedAt ? Date.now() - state.pausedAt : 0),
    })),
  setStats: (stats) => set({ stats }),
  setLive: (live) => set((state) => ({ live: { ...state.live, ...live } })),
  reset: () =>
    set({
      trackId: null,
      status: 'idle',
      startedAt: null,
      pausedAt: null,
      pausedMs: 0,
      stats: EMPTY_STATS,
      live: EMPTY_LIVE,
    }),
}));
