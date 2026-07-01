import type { LngLat, LngLatBounds, StyleSpecification } from '@maplibre/maplibre-react-native';

import type { TrackPoint } from '@/db/types';

/**
 * Builds the MapTiler "Outdoor" raster style: contour lines, trails, and peaks
 * suited to hiking. The `token` is appended as a query param. MapTiler's terms
 * permit offline caching of bounded areas (unlike the public OSM servers), so the
 * offline downloader can use this style directly.
 *
 * Two deliberate choices minimize MapTiler tile requests (billed per request):
 * - **512px tiles** (no `/256/` segment, `tileSize: 512`): one 512px tile covers
 *   the area of four 256px tiles, so a viewport costs ~4x fewer requests.
 * - **`maxzoom: 14`**: beyond z14 MapLibre upscales cached/offline-pack tiles
 *   instead of fetching, so the app can never request the z15-20 tile explosion.
 *   "Large scale" detail past z14 comes from downloaded offline packs (served
 *   locally with zero requests). Do not raise this to chase sharper deep zoom.
 *
 * The token is supplied by the caller (see `MAPTILER_TOKEN` in
 * `@/state/mapTokenStore`) rather than read here.
 */
export function buildRasterStyle(token: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      maptiler: {
        type: 'raster',
        tiles: [`https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${token}`],
        tileSize: 512,
        maxzoom: 14,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'maptiler',
        type: 'raster',
        source: 'maptiler',
      },
    ],
  };
}

/** Map style serialized for the offline pack downloader (expects a string). */
export function buildStyleJson(token: string): string {
  return JSON.stringify(buildRasterStyle(token));
}

/**
 * Tile URL template for MapTiler's Terrain-RGB DEM (Mapbox encoding), fed to a
 * `RasterDEMSource` so MapLibre can render a client-side `hillshade` layer. This
 * is more portable than guessing a pre-rendered hillshade raster tileset; if the
 * MapTiler account exposes the DEM under a different id, change it here only.
 */
export function buildTerrainDemUrl(token: string): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${token}`;
}

/** MapTiler Terrain-RGB v2 tops out at zoom 12; the DEM source must cap there. */
export const TERRAIN_DEM_MAXZOOM = 12;

/** Default camera position: centered on Taiwan. */
export const TAIWAN_CENTER: LngLat = [120.96, 23.7];
export const DEFAULT_ZOOM = 7;

/** Builds a GeoJSON LineString from ordered track points for map rendering. */
export function pointsToLineString(points: TrackPoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lon, p.lat]),
    },
  };
}

/**
 * Computes the bounding box of GeoJSON `[lon, lat]` coordinates as a MapLibre
 * `[west, south, east, north]` tuple the camera can fit. Returns null when empty.
 */
export function boundsOfCoords(coords: number[][]): LngLatBounds | null {
  if (coords.length === 0) return null;
  let [west, south] = coords[0];
  let [east, north] = coords[0];
  for (const [lon, lat] of coords) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

/** Returns the most recent point as a [lon, lat] tuple, or null. */
export function lastCoordinate(points: TrackPoint[]): LngLat | null {
  if (points.length === 0) return null;
  const p = points[points.length - 1];
  return [p.lon, p.lat];
}

/** Formats a coordinate as decimal degrees, e.g. `25.03304, 121.56542`. */
export function formatCoordinate(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/**
 * Midpoint of two `[lon, lat]` coordinates. A planar average, which is accurate
 * enough at trail scale for placing an insert handle between two route vertices.
 */
export function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
