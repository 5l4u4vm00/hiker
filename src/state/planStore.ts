import { create } from 'zustand';

import { createId } from '@/db/client';
import type { Route, RouteDifficulty, Waypoint, WaypointType } from '@/db/types';

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

/**
 * Editing mode. A map tap means exactly one thing per mode: `draw` appends a
 * route point, `edit` selects/deselects vertices (drag/insert/delete), and
 * `waypoint` drops a waypoint.
 */
export type PlanMode = 'draw' | 'edit' | 'waypoint';

/** Geometry snapshot captured before an edit so it can be undone. */
interface GeometrySnapshot {
  points: LngLatTuple[];
  waypoints: DraftWaypoint[];
}

/** Cap on retained undo snapshots. */
const HISTORY_LIMIT = 50;

interface PlanState {
  /** Ordered route vertices. */
  points: LngLatTuple[];
  waypoints: DraftWaypoint[];
  /** Index of the highlighted vertex (for the delete affordance), or null. */
  selectedVertex: number | null;
  /** Active editing mode. */
  mode: PlanMode;
  /** Id of the saved route being edited, or null when drawing a fresh route. */
  editingRouteId: string | null;
  name: string;
  difficulty: RouteDifficulty | null;
  region: string | null;
  /** Elevations (m) parallel to `points`; empty until fetched. */
  elevations: (number | null)[];
  elevationStatus: ElevationStatus;
  /** Snapshots of geometry before each edit, for undo (most recent last). */
  history: GeometrySnapshot[];

  // Point editing — each invalidates the cached elevations and pushes history.
  appendPoint: (p: LngLatTuple) => void;
  moveVertex: (index: number, p: LngLatTuple) => void;
  insertPoint: (afterIndex: number, p: LngLatTuple) => void;
  removeVertex: (index: number) => void;
  /** Revert the most recent edit (points + waypoints). */
  undo: () => void;
  selectVertex: (index: number | null) => void;
  /** Switch editing mode; also clears any current selection. */
  setMode: (mode: PlanMode) => void;
  clearAll: () => void;

  /** Load a saved route and its waypoints into the draft for editing. */
  loadRoute: (route: Route, waypoints: Waypoint[]) => void;

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
  mode: 'draw' as PlanMode,
  editingRouteId: null,
  name: '',
  difficulty: null,
  region: null,
  elevations: [] as (number | null)[],
  elevationStatus: 'idle' as ElevationStatus,
  history: [] as GeometrySnapshot[],
};

/** Append the current geometry to the (capped) undo stack. */
function pushHistory(s: PlanState): GeometrySnapshot[] {
  return [...s.history, { points: s.points, waypoints: s.waypoints }].slice(-HISTORY_LIMIT);
}

export const usePlanStore = create<PlanState>((set) => ({
  ...INITIAL,

  appendPoint: (p) =>
    set((s) => ({ history: pushHistory(s), points: [...s.points, p], ...STALE_ELEVATION })),

  moveVertex: (index, p) =>
    set((s) => ({
      history: pushHistory(s),
      points: s.points.map((q, i) => (i === index ? p : q)),
      ...STALE_ELEVATION,
    })),

  insertPoint: (afterIndex, p) =>
    set((s) => {
      const points = [...s.points];
      points.splice(afterIndex + 1, 0, p);
      return { history: pushHistory(s), points, ...STALE_ELEVATION };
    }),

  removeVertex: (index) =>
    set((s) => ({
      history: pushHistory(s),
      points: s.points.filter((_, i) => i !== index),
      selectedVertex: null,
      ...STALE_ELEVATION,
    })),

  undo: () =>
    set((s) => {
      const prev = s.history[s.history.length - 1];
      if (!prev) return {};
      return {
        points: prev.points,
        waypoints: prev.waypoints,
        history: s.history.slice(0, -1),
        selectedVertex: null,
        ...STALE_ELEVATION,
      };
    }),

  selectVertex: (index) => set({ selectedVertex: index }),

  setMode: (mode) => set({ mode, selectedVertex: null }),

  clearAll: () =>
    set((s) => ({
      history: pushHistory(s),
      points: [],
      waypoints: [],
      selectedVertex: null,
      ...STALE_ELEVATION,
    })),

  loadRoute: (route, waypoints) =>
    set({
      points: route.geometry.coordinates.map(([lon, lat]) => [lon, lat] as LngLatTuple),
      waypoints: waypoints.map((w) => ({
        id: w.id,
        lngLat: [w.lon, w.lat] as LngLatTuple,
        name: w.name,
        type: w.type,
      })),
      selectedVertex: null,
      mode: 'edit',
      editingRouteId: route.id,
      name: route.name,
      region: route.region,
      difficulty: route.difficulty,
      history: [],
      ...STALE_ELEVATION,
    }),

  addWaypoint: (wp) =>
    set((s) => ({ history: pushHistory(s), waypoints: [...s.waypoints, { ...wp, id: createId() }] })),

  updateWaypoint: (id, patch) =>
    set((s) => ({
      history: pushHistory(s),
      waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  removeWaypoint: (id) =>
    set((s) => ({ history: pushHistory(s), waypoints: s.waypoints.filter((w) => w.id !== id) })),

  setMeta: (patch) => set(patch),

  setElevations: (elevations, status) => set({ elevations, elevationStatus: status }),

  reset: () => set(INITIAL),
}));
