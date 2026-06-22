import { upsertRoute } from '@/db/routes';
import type { Route } from '@/db/types';
import type { OverpassRouteResult } from '@/data/overpass';

/**
 * Persists a chosen Overpass search result to SQLite under its stable osm key.
 * Idempotent: re-saving the same relation updates the row in place rather than
 * creating a duplicate. The route's `source` is already `'osm'`.
 */
export async function saveOverpassRoute(result: OverpassRouteResult): Promise<Route> {
  const { key, ...input } = result;
  return upsertRoute(input, key);
}
