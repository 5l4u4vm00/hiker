import { create } from 'zustand';

import type { OverpassRouteResult } from '@/data/overpass';

/**
 * Holds the OpenStreetMap search result the user tapped to preview. It is kept
 * in memory only and is NOT in SQLite yet: the route detail screen renders this
 * preview by key, and persists it (via saveOverpassRoute) only when the user
 * downloads its offline map or follows it. Backing out leaves nothing saved.
 */
interface RoutePreviewState {
  preview: OverpassRouteResult | null;
  setPreview: (preview: OverpassRouteResult | null) => void;
}

export const useRoutePreviewStore = create<RoutePreviewState>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
}));
