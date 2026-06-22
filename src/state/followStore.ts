import { create } from 'zustand';

/**
 * The route the user has chosen to follow on the Map screen. Purely UI-facing
 * navigation intent (the route itself lives in SQLite), so it is kept in memory
 * only — the Map screen loads the route geometry/waypoints from the DB by id.
 */
interface FollowState {
  routeId: string | null;
  follow: (routeId: string) => void;
  clear: () => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  routeId: null,
  follow: (routeId) => set({ routeId }),
  clear: () => set({ routeId: null }),
}));
