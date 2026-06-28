import { addWaypoint, deleteRouteWaypoints, upsertRoute } from '@/db/routes';
import type { Route, RouteDifficulty } from '@/db/types';
import type { DraftWaypoint, ElevationStatus, LngLatTuple } from '@/state/planStore';
import { ascentFromElevations, distanceOf } from '@/tracking/stats';

export interface PlannedRouteDraft {
  /** When set, the existing route is updated in place rather than created. */
  id?: string;
  name: string;
  region: string | null;
  difficulty: RouteDifficulty | null;
  points: LngLatTuple[];
  waypoints: DraftWaypoint[];
  elevations: (number | null)[];
  elevationStatus: ElevationStatus;
}

/**
 * Persists a hand-drawn plan as a `manual` route plus its waypoints. Distance is
 * computed offline from the geometry; ascent comes from the fetched elevations
 * when available, otherwise 0. The default region matches the GPX importer
 * convention so manual and imported routes group together. When `draft.id` is
 * set the route is updated in place and its waypoints are replaced.
 */
export async function savePlannedRoute(draft: PlannedRouteDraft): Promise<Route> {
  const distanceM = distanceOf(draft.points);
  const ascentM =
    draft.elevationStatus === 'ready' ? ascentFromElevations(draft.elevations) : 0;

  const route = await upsertRoute(
    {
      name: draft.name.trim(),
      region: draft.region?.trim() || 'Taiwan',
      difficulty: draft.difficulty,
      distanceM,
      ascentM,
      source: 'manual',
      geometry: { type: 'LineString', coordinates: draft.points },
    },
    draft.id,
  );

  if (draft.id) {
    await deleteRouteWaypoints(draft.id);
  }

  for (const wp of draft.waypoints) {
    await addWaypoint({
      routeId: route.id,
      trackId: null,
      lat: wp.lngLat[1],
      lon: wp.lngLat[0],
      name: wp.name,
      type: wp.type,
    });
  }

  return route;
}
