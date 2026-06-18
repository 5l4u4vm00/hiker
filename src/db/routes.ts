import { createId, getDatabase } from './client';
import type { Route, RouteDifficulty, RouteSource, Waypoint, WaypointType } from './types';

interface RouteRow {
  id: string;
  name: string;
  region: string | null;
  difficulty: string | null;
  distance_m: number;
  ascent_m: number;
  source: string;
  geometry: string;
}

interface WaypointRow {
  id: string;
  route_id: string | null;
  track_id: string | null;
  lat: number;
  lon: number;
  name: string;
  type: string;
}

function mapRoute(row: RouteRow): Route {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    difficulty: row.difficulty as RouteDifficulty | null,
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    source: row.source as RouteSource,
    geometry: JSON.parse(row.geometry) as GeoJSON.LineString,
  };
}

function mapWaypoint(row: WaypointRow): Waypoint {
  return {
    id: row.id,
    routeId: row.route_id,
    trackId: row.track_id,
    lat: row.lat,
    lon: row.lon,
    name: row.name,
    type: row.type as WaypointType,
  };
}

export type RouteInput = Omit<Route, 'id'>;

export async function upsertRoute(route: RouteInput, id = createId()): Promise<Route> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO routes (id, name, region, difficulty, distance_m, ascent_m, source, geometry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       region = excluded.region,
       difficulty = excluded.difficulty,
       distance_m = excluded.distance_m,
       ascent_m = excluded.ascent_m,
       source = excluded.source,
       geometry = excluded.geometry`,
    id,
    route.name,
    route.region,
    route.difficulty,
    route.distanceM,
    route.ascentM,
    route.source,
    JSON.stringify(route.geometry),
  );
  return { ...route, id };
}

export async function listRoutes(): Promise<Route[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RouteRow>('SELECT * FROM routes ORDER BY name ASC');
  return rows.map(mapRoute);
}

export interface RouteFilters {
  keyword?: string;
  region?: string;
}

/**
 * Lists routes matching an optional free-text keyword (name or region) and/or
 * an exact region. With no filters this returns every route. Results are
 * ordered by name; callers may re-order by proximity client-side.
 */
export async function queryRoutes(filters: RouteFilters = {}): Promise<Route[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: string[] = [];

  const keyword = filters.keyword?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    clauses.push('(name LIKE ? OR region LIKE ?)');
    params.push(like, like);
  }
  const region = filters.region?.trim();
  if (region) {
    clauses.push('region = ?');
    params.push(region);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.getAllAsync<RouteRow>(
    `SELECT * FROM routes ${where} ORDER BY name ASC`,
    ...params,
  );
  return rows.map(mapRoute);
}

/** Distinct, non-empty region names across all routes, ordered alphabetically. */
export async function listRegions(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ region: string }>(
    "SELECT DISTINCT region FROM routes WHERE region IS NOT NULL AND region <> '' ORDER BY region ASC",
  );
  return rows.map((r) => r.region);
}

export async function getRoute(id: string): Promise<Route | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RouteRow>('SELECT * FROM routes WHERE id = ?', id);
  return row ? mapRoute(row) : null;
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM routes WHERE id = ?', id);
}

export async function countRoutes(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routes');
  return row?.count ?? 0;
}

export async function addWaypoint(
  waypoint: Omit<Waypoint, 'id'>,
  id = createId(),
): Promise<Waypoint> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO waypoints (id, route_id, track_id, lat, lon, name, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    waypoint.routeId,
    waypoint.trackId,
    waypoint.lat,
    waypoint.lon,
    waypoint.name,
    waypoint.type,
  );
  return { ...waypoint, id };
}

export async function getRouteWaypoints(routeId: string): Promise<Waypoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<WaypointRow>(
    'SELECT * FROM waypoints WHERE route_id = ?',
    routeId,
  );
  return rows.map(mapWaypoint);
}
