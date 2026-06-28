import type { Waypoint } from '@/db/types';

import { haversine, type LatLon } from './stats';

const EARTH_RADIUS_M = 6371000;
const M_PER_DEG = (Math.PI / 180) * EARTH_RADIUS_M;

/**
 * Precomputed lookup for a route polyline, built once per followed path so that
 * each live projection is cheap. `cumulative[i]` is the distance (m) along the
 * route from the first vertex to vertex `i`; `cumulative[0]` is 0.
 */
export interface RouteIndex {
  /** Route vertices as GeoJSON `[lon, lat]` pairs. */
  coords: GeoJSON.Position[];
  /** Cumulative along-route distance (m) at each vertex. */
  cumulative: number[];
  /** Total route length (m). */
  totalM: number;
}

export function buildRouteIndex(coords: GeoJSON.Position[]): RouteIndex {
  const cumulative: number[] = new Array(coords.length);
  let total = 0;
  for (let i = 0; i < coords.length; i++) {
    if (i === 0) {
      cumulative[0] = 0;
    } else {
      const [lon0, lat0] = coords[i - 1];
      const [lon1, lat1] = coords[i];
      total += haversine({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 });
      cumulative[i] = total;
    }
  }
  return { coords, cumulative, totalM: total };
}

/** Result of snapping a live position onto the route polyline. */
export interface RouteProjection {
  /** Closest distance (m) from the origin to the route line. */
  distanceToRouteM: number;
  /** Distance (m) along the route from the start to the snapped foot. */
  alongM: number;
  /** The snapped foot as `[lon, lat]`. */
  snapped: [number, number];
  /** Index of the segment's start vertex. */
  segmentIndex: number;
}

/**
 * Projects a position onto the nearest segment of a route. Distances use a local
 * equirectangular approximation (meters), accurate enough at trail scale. Unlike
 * `nearestPointDistanceM` (which only finds the nearest vertex), this snaps to the
 * perpendicular foot on each segment so progress along the route is continuous.
 */
export function projectOnRoute(origin: LatLon, index: RouteIndex): RouteProjection | null {
  const { coords, cumulative } = index;
  if (coords.length === 0) return null;
  if (coords.length === 1) {
    const [lon, lat] = coords[0];
    return {
      distanceToRouteM: haversine(origin, { lat, lon }),
      alongM: 0,
      snapped: [lon, lat],
      segmentIndex: 0,
    };
  }

  // Local planar projection centered on the origin's latitude.
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const toXY = (lon: number, lat: number) => ({ x: lon * M_PER_DEG * cosLat, y: lat * M_PER_DEG });
  const o = toXY(origin.lon, origin.lat);

  let bestDist2 = Infinity;
  let bestAlongM = 0;
  let bestSnapped: [number, number] = [coords[0][0], coords[0][1]];
  let bestSegment = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = toXY(coords[i][0], coords[i][1]);
    const b = toXY(coords[i + 1][0], coords[i + 1][1]);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const segLen2 = abx * abx + aby * aby;
    let t = segLen2 === 0 ? 0 : ((o.x - a.x) * abx + (o.y - a.y) * aby) / segLen2;
    t = Math.max(0, Math.min(1, t));
    const fx = a.x + t * abx;
    const fy = a.y + t * aby;
    const dx = o.x - fx;
    const dy = o.y - fy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestAlongM = cumulative[i] + t * (cumulative[i + 1] - cumulative[i]);
      bestSnapped = [
        coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
      ];
      bestSegment = i;
    }
  }

  return {
    distanceToRouteM: Math.sqrt(bestDist2),
    alongM: bestAlongM,
    snapped: bestSnapped,
    segmentIndex: bestSegment,
  };
}

/** A waypoint with its position resolved to a distance along the route. */
export interface WaypointAlong {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Distance (m) along the route from the start to this waypoint. */
  alongM: number;
}

/** Projects each waypoint onto the route to get its along-route position. */
export function projectWaypoints(waypoints: Waypoint[], index: RouteIndex): WaypointAlong[] {
  return waypoints.map((w) => {
    const proj = projectOnRoute({ lat: w.lat, lon: w.lon }, index);
    return { id: w.id, name: w.name, lat: w.lat, lon: w.lon, alongM: proj?.alongM ?? 0 };
  });
}
