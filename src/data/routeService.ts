import Constants from 'expo-constants';

import { deleteRoute, listRoutes, upsertRoute, type RouteInput } from '@/db/routes';
import type { RouteDifficulty } from '@/db/types';

/**
 * Where the route catalog is fetched from. Override per build via
 * `expo.extra.routesEndpoint` in app.json; the fallback points at the bundled
 * data file's expected hosted location.
 */
const FALLBACK_ENDPOINT =
  'https://raw.githubusercontent.com/5l4u4vm00/hiker/main/data/routes.json';

export const ROUTES_ENDPOINT: string =
  (Constants.expoConfig?.extra?.routesEndpoint as string | undefined) ?? FALLBACK_ENDPOINT;

const FETCH_TIMEOUT_MS = 10000;

const DIFFICULTIES: RouteDifficulty[] = ['easy', 'moderate', 'hard', 'expert'];

interface RemoteRoute extends RouteInput {
  key: string;
}

/** Narrows an unknown JSON entry into a valid RemoteRoute, or null if malformed. */
function parseRoute(raw: unknown): RemoteRoute | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.key !== 'string' || !r.key) return null;
  if (typeof r.name !== 'string' || !r.name) return null;

  const geometry = r.geometry as { type?: unknown; coordinates?: unknown } | undefined;
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const coordinates = geometry.coordinates.filter(
    (c): c is [number, number] =>
      Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number',
  );
  if (coordinates.length === 0) return null;

  const difficulty =
    typeof r.difficulty === 'string' && DIFFICULTIES.includes(r.difficulty as RouteDifficulty)
      ? (r.difficulty as RouteDifficulty)
      : null;

  return {
    key: r.key,
    name: r.name,
    region: typeof r.region === 'string' ? r.region : null,
    difficulty,
    distanceM: typeof r.distanceM === 'number' ? r.distanceM : 0,
    ascentM: typeof r.ascentM === 'number' ? r.ascentM : 0,
    source: 'remote',
    geometry: { type: 'LineString', coordinates },
  };
}

/** Fetches and validates the remote route catalog. Throws on network failure. */
export async function fetchRemoteRoutes(): Promise<RemoteRoute[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ROUTES_ENDPOINT, { signal: controller.signal });
    if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
    const body = (await res.json()) as { routes?: unknown };
    const list = Array.isArray(body.routes) ? body.routes : [];
    return list.map(parseRoute).filter((r): r is RemoteRoute => r !== null);
  } finally {
    clearTimeout(timeout);
  }
}

export type SyncResult = { ok: true; count: number } | { ok: false };

/**
 * Fetches the remote catalog and caches it in SQLite: upserts each route (keyed
 * by its stable `key`) and removes previously-synced remote routes that are no
 * longer present. User-imported ('gpx') and manual routes are left untouched.
 * Returns `{ ok: false }` on any network/parse failure instead of throwing.
 */
export async function syncRoutes(): Promise<SyncResult> {
  let remote: RemoteRoute[];
  try {
    remote = await fetchRemoteRoutes();
  } catch {
    return { ok: false };
  }

  const incomingKeys = new Set(remote.map((r) => r.key));
  for (const { key, ...input } of remote) {
    await upsertRoute(input, key);
  }

  const existing = await listRoutes();
  for (const route of existing) {
    if (route.source === 'remote' && !incomingKeys.has(route.id)) {
      await deleteRoute(route.id);
    }
  }

  return { ok: true, count: remote.length };
}
