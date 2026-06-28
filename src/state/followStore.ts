import { create } from 'zustand';

/**
 * The path the user has chosen to follow on the Map screen — either a saved
 * route or one of their own recorded tracks. Purely UI-facing navigation intent
 * (the path itself lives in SQLite), so it is kept in memory only — the Map
 * screen loads the geometry/waypoints from the DB by kind + id.
 */
export type FollowKind = 'route' | 'track';

interface FollowState {
  kind: FollowKind | null;
  id: string | null;
  follow: (kind: FollowKind, id: string) => void;
  clear: () => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  kind: null,
  id: null,
  follow: (kind, id) => set({ kind, id }),
  clear: () => set({ kind: null, id: null }),
}));
