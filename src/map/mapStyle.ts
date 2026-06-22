import type { LngLat, StyleSpecification } from '@maplibre/maplibre-react-native';

import type { TrackPoint } from '@/db/types';

/**
 * MapTiler API key, read from the `EXPO_PUBLIC_MAPTILER_KEY` env var (see
 * `.env.example`). `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build
 * time. The key is therefore shipped in the client — restrict it by allowed
 * origins / bundle id in the MapTiler dashboard rather than treating it as a
 * secret. We deliberately avoid `expo.extra`/`Constants`, which freeze at native
 * build time, so the value can change without a full native rebuild.
 */
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

if (!MAPTILER_KEY && __DEV__) {
  console.warn(
    '[map] EXPO_PUBLIC_MAPTILER_KEY is not set — map tiles will fail to load. ' +
      'Copy .env.example to .env and add your MapTiler key.',
  );
}

/**
 * MapTiler "Outdoor" raster style: contour lines, trails, and peaks suited to
 * hiking. Tiles are 256px and the key is appended as a query param. MapTiler's
 * terms permit offline caching of bounded areas (unlike the public OSM servers),
 * so the offline downloader can use this style directly.
 */
export const MAP_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    maptiler: {
      type: 'raster',
      tiles: [`https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`],
      tileSize: 256,
      maxzoom: 20,
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

/** Map style serialized for the offline pack downloader (expects a string). */
export const MAP_STYLE_JSON = JSON.stringify(MAP_RASTER_STYLE);

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

/** Returns the most recent point as a [lon, lat] tuple, or null. */
export function lastCoordinate(points: TrackPoint[]): LngLat | null {
  if (points.length === 0) return null;
  const p = points[points.length - 1];
  return [p.lon, p.lat];
}
