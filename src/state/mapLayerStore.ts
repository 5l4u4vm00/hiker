import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';
import type { WaypointType } from '@/db/types';

/**
 * Which optional hiking layers are drawn over the basemap, shared by the Plan
 * screen and the main Map tab. Persisted as one JSON blob in the SQLite
 * `settings` table (mirroring `themeStore`/`languageStore`) and hydrated at
 * startup so a user's layer choices survive relaunches and carry across screens.
 */
const STORAGE_KEY = 'map_layers';

/** Boolean (on/off) layers, keyed for a generic setter. */
export type BooleanLayer = 'hillshade' | 'distanceMarkers' | 'nearbyRoutes';

interface MapLayerState {
  /** Shaded-relief terrain overlay (client-side hillshade from a DEM source). */
  hillshade: boolean;
  /** Kilometre tick markers along the active route line. */
  distanceMarkers: boolean;
  /** Other saved routes near the active area, drawn as faint reference lines. */
  nearbyRoutes: boolean;
  /** POI categories currently shown (bundled POIs + the user's own waypoints). */
  poiCategories: WaypointType[];

  setLayer: (layer: BooleanLayer, value: boolean) => void;
  togglePoiCategory: (category: WaypointType) => void;
  /** Loads the persisted layer choices from SQLite at startup. */
  hydrate: () => Promise<void>;
}

const DEFAULTS = {
  hillshade: false,
  distanceMarkers: false,
  nearbyRoutes: false,
  // The amenities a planner cares about most; everything else starts hidden.
  poiCategories: ['hut', 'water', 'shelter'] as WaypointType[],
};

/** Serializes only the persisted slice (drops the action methods). */
function persist(state: MapLayerState): void {
  const { hillshade, distanceMarkers, nearbyRoutes, poiCategories } = state;
  void setSetting(STORAGE_KEY, JSON.stringify({ hillshade, distanceMarkers, nearbyRoutes, poiCategories }));
}

export const useMapLayerStore = create<MapLayerState>((set, get) => ({
  ...DEFAULTS,

  setLayer: (layer, value) => {
    set({ [layer]: value } as Pick<MapLayerState, BooleanLayer>);
    persist(get());
  },

  togglePoiCategory: (category) => {
    set((s) => ({
      poiCategories: s.poiCategories.includes(category)
        ? s.poiCategories.filter((c) => c !== category)
        : [...s.poiCategories, category],
    }));
    persist(get());
  },

  hydrate: async () => {
    const stored = await getSetting(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<MapLayerState>;
      set({
        hillshade: parsed.hillshade ?? DEFAULTS.hillshade,
        distanceMarkers: parsed.distanceMarkers ?? DEFAULTS.distanceMarkers,
        nearbyRoutes: parsed.nearbyRoutes ?? DEFAULTS.nearbyRoutes,
        poiCategories: Array.isArray(parsed.poiCategories)
          ? parsed.poiCategories
          : DEFAULTS.poiCategories,
      });
    } catch {
      // Corrupt value — keep defaults.
    }
  },
}));
