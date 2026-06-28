import { create } from 'zustand';

import { createId } from '@/db/client';
import type { RouteDifficulty, WaypointType } from '@/db/types';

/**
 * In-progress route the user is drawing on the Plan screen. Held in memory only
 * (a draft is not persisted until saved); the screen subscribes to it and the
 * debounced elevation fetch writes back into it. Coordinates are `[lon, lat]`
 * tuples, matching `Route.geometry` and MapLibre.
 */
export type LngLatTuple = [number, number];

export interface DraftWaypoint {
  id: string;
  lngLat: LngLatTuple;
  name: string;
  type: WaypointType;
}

/** Whether elevations for the current points have been fetched. */
export type ElevationStatus = 'idle' | 'loading' | 'ready' | 'unknown';

interface PlanState {
  /** Ordered route vertices. */
  points: LngLatTuple[];
  waypoints: DraftWaypoint[];
  /** Index of the highlighted vertex (for the delete affordance), or null. */
  selectedVertex: number | null;
  name: string;
  difficulty: RouteDifficulty | null;
  region: string | null;
  /** Elevations (m) parallel to `points`; empty until fetched. */
  elevations: (number | null)[];
  elevationStatus: ElevationStatus;

  // Point editing — each invalidates the cached elevations.
  appendPoint: (p: LngLatTuple) => void;
  moveVertex: (index: number, p: LngLatTuple) => void;
  insertPoint: (afterIndex: number, p: LngLatTuple) => void;
  removeVertex: (index: number) => void;
  undoLastPoint: () => void;
  selectVertex: (index: number | null) => void;
  clearAll: () => void;

  // Waypoints.
  addWaypoint: (wp: Omit<DraftWaypoint, 'id'>) => void;
  updateWaypoint: (id: string, patch: Partial<Omit<DraftWaypoint, 'id'>>) => void;
  removeWaypoint: (id: string) => void;

  // Metadata.
  setMeta: (patch: {
    name?: string;
    difficulty?: RouteDifficulty | null;
    region?: string | null;
  }) => void;

  // Elevation.
  setElevations: (elevations: (number | null)[], status: ElevationStatus) => void;

  reset: () => void;
}

/** Editing the geometry invalidates any previously fetched elevations. */
const STALE_ELEVATION = { elevations: [], elevationStatus: 'idle' as const };

const INITIAL = {
  points: [] as LngLatTuple[],
  waypoints: [] as DraftWaypoint[],
  selectedVertex: null,
  name: '',
  difficulty: null,
  region: null,
  elevations: [] as (number | null)[],
  elevationStatus: 'idle' as ElevationStatus,
};

export const usePlanStore = create<PlanState>((set) => ({
  ...INITIAL,

  appendPoint: (p) =>
    set((s) => ({ points: [...s.points, p], ...STALE_ELEVATION })),

  moveVertex: (index, p) =>
    set((s) => ({
      points: s.points.map((q, i) => (i === index ? p : q)),
      ...STALE_ELEVATION,
    })),

  insertPoint: (afterIndex, p) =>
    set((s) => {
      const points = [...s.points];
      points.splice(afterIndex + 1, 0, p);
      return { points, ...STALE_ELEVATION };
    }),

  removeVertex: (index) =>
    set((s) => ({
      points: s.points.filter((_, i) => i !== index),
      selectedVertex: null,
      ...STALE_ELEVATION,
    })),

  undoLastPoint: () =>
    set((s) => ({ points: s.points.slice(0, -1), selectedVertex: null, ...STALE_ELEVATION })),

  selectVertex: (index) => set({ selectedVertex: index }),

  clearAll: () =>
    set({ points: [], waypoints: [], selectedVertex: null, ...STALE_ELEVATION }),

  addWaypoint: (wp) =>
    set((s) => ({ waypoints: [...s.waypoints, { ...wp, id: createId() }] })),

  updateWaypoint: (id, patch) =>
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  removeWaypoint: (id) =>
    set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),

  setMeta: (patch) => set(patch),

  setElevations: (elevations, status) => set({ elevations, elevationStatus: status }),

  reset: () => set(INITIAL),
}));
