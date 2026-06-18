import type { LngLat, StyleSpecification } from '@maplibre/maplibre-react-native';

import type { TrackPoint } from '@/db/types';

/**
 * OpenStreetMap raster style. Free and requires no token, suitable for
 * development. For production, switch `tiles` to your own tile server or a
 * licensed provider — the public OSM tile servers forbid heavy/bulk use
 * (including large offline downloads).
 */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

/** Map style serialized for the offline pack downloader (expects a string). */
export const OSM_STYLE_JSON = JSON.stringify(OSM_RASTER_STYLE);

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
