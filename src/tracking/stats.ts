import type { TrackPoint } from '@/db/types';

const EARTH_RADIUS_M = 6371000;

/** Minimum elevation change (m) counted toward ascent/descent to filter GPS noise. */
const ELEVATION_THRESHOLD_M = 3;

export interface LatLon {
  lat: number;
  lon: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in meters. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ComputedStats {
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxAlt: number | null;
  durationS: number;
}

/**
 * Derives cumulative stats from an ordered list of GPS points. Elevation gain
 * uses a threshold so small GPS altitude jitter is not counted as climbing.
 */
export function computeStats(points: TrackPoint[]): ComputedStats {
  if (points.length === 0) {
    return { distanceM: 0, ascentM: 0, descentM: 0, maxAlt: null, durationS: 0 };
  }

  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxAlt: number | null = null;
  let refAlt: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      distanceM += haversine(points[i - 1], p);
    }
    if (p.alt != null) {
      maxAlt = maxAlt == null ? p.alt : Math.max(maxAlt, p.alt);
      if (refAlt == null) {
        refAlt = p.alt;
      } else {
        const delta = p.alt - refAlt;
        if (delta >= ELEVATION_THRESHOLD_M) {
          ascentM += delta;
          refAlt = p.alt;
        } else if (delta <= -ELEVATION_THRESHOLD_M) {
          descentM += -delta;
          refAlt = p.alt;
        }
      }
    }
  }

  const durationS = Math.max(
    0,
    Math.round((points[points.length - 1].recordedAt - points[0].recordedAt) / 1000),
  );

  return { distanceM, ascentM, descentM, maxAlt, durationS };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatElevation(meters: number | null): string {
  if (meters == null) return '--';
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Average pace in minutes per kilometer, formatted as `mm:ss /km`. */
export function formatPace(distanceM: number, durationS: number): string {
  if (distanceM < 1 || durationS < 1) return '--';
  const paceSecPerKm = durationS / (distanceM / 1000);
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
