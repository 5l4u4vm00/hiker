import type { TrackPoint } from '@/db/types';
import i18n from '@/i18n';

const EARTH_RADIUS_M = 6371000;

/** Minimum elevation change (m) counted toward ascent/descent to filter GPS noise. */
const ELEVATION_THRESHOLD_M = 3;

/** Minimum segment speed (m/s, ~1.1 km/h) for time to count as "moving". */
const MOVING_SPEED_THRESHOLD_MPS = 0.3;

/** Segments longer than this (s) are treated as a stop/signal loss, not motion. */
const MAX_SEGMENT_GAP_S = 120;

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

/**
 * Minimum great-circle distance (m) from an origin to any coordinate in a
 * route geometry. Coordinates are GeoJSON `[lon, lat]` pairs. Returns Infinity
 * for empty input so such routes sort last when ordering by proximity.
 */
export function nearestPointDistanceM(origin: LatLon, coords: GeoJSON.Position[]): number {
  let min = Infinity;
  for (const [lon, lat] of coords) {
    const d = haversine(origin, { lat, lon });
    if (d < min) min = d;
  }
  return min;
}

export interface ComputedStats {
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxAlt: number | null;
  durationS: number;
  /** Time spent actually moving (s), excluding stops and long signal gaps. */
  movingTimeS: number;
  /** Fastest segment speed observed (m/s), or null if not derivable. */
  maxSpeed: number | null;
}

/**
 * Derives cumulative stats from an ordered list of GPS points. Elevation gain
 * uses a threshold so small GPS altitude jitter is not counted as climbing.
 */
export function computeStats(points: TrackPoint[]): ComputedStats {
  if (points.length === 0) {
    return {
      distanceM: 0,
      ascentM: 0,
      descentM: 0,
      maxAlt: null,
      durationS: 0,
      movingTimeS: 0,
      maxSpeed: null,
    };
  }

  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxAlt: number | null = null;
  let refAlt: number | null = null;
  let movingTimeS = 0;
  let maxSpeed: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      const segDist = haversine(points[i - 1], p);
      distanceM += segDist;
      const segDt = (p.recordedAt - points[i - 1].recordedAt) / 1000;
      if (segDt > 0 && segDt <= MAX_SEGMENT_GAP_S) {
        const segSpeed = segDist / segDt;
        if (segSpeed >= MOVING_SPEED_THRESHOLD_MPS) {
          movingTimeS += segDt;
        }
        if (segDt >= 1) {
          maxSpeed = maxSpeed == null ? segSpeed : Math.max(maxSpeed, segSpeed);
        }
      }
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

  return {
    distanceM,
    ascentM,
    descentM,
    maxAlt,
    durationS,
    movingTimeS: Math.min(durationS, Math.round(movingTimeS)),
    maxSpeed,
  };
}

/**
 * Cumulative elevation gain (m) from a sequence of point elevations, applying
 * the same noise threshold as {@link computeStats}. `null` entries (points whose
 * elevation is unknown) are skipped. Shared by GPX import and route planning so
 * both derive ascent the same way.
 */
export function ascentFromElevations(elevations: (number | null)[]): number {
  let ascentM = 0;
  let refEle: number | null = null;
  for (const ele of elevations) {
    if (ele == null) continue;
    if (refEle == null) refEle = ele;
    else if (ele - refEle >= ELEVATION_THRESHOLD_M) {
      ascentM += ele - refEle;
      refEle = ele;
    } else if (refEle - ele >= ELEVATION_THRESHOLD_M) {
      refEle = ele;
    }
  }
  return ascentM;
}

/**
 * Total length (m) of a `[lon, lat]` polyline, summing the great-circle distance
 * between consecutive vertices. Returns 0 for fewer than two points.
 */
export function distanceOf(points: [number, number][]): number {
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    distanceM += haversine(
      { lat: points[i - 1][1], lon: points[i - 1][0] },
      { lat: points[i][1], lon: points[i][0] },
    );
  }
  return distanceM;
}

/**
 * Estimated walking time (s) by Naismith's rule: ~12 min per km of distance plus
 * 1 hour per 600 m of ascent. A planning estimate, not a guarantee.
 */
export function naismithSeconds(distanceM: number, ascentM: number): number {
  return (distanceM / 1000) * 12 * 60 + (Math.max(0, ascentM) / 600) * 3600;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} ${i18n.t('units.m')}`;
  return `${(meters / 1000).toFixed(2)} ${i18n.t('units.km')}`;
}

export function formatElevation(meters: number | null): string {
  if (meters == null) return '--';
  return `${Math.round(meters)} ${i18n.t('units.m')}`;
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
  return `${m}:${String(s).padStart(2, '0')} ${i18n.t('units.perKm')}`;
}

/** Speed in km/h, formatted as `X.X km/h`. */
export function formatSpeed(mps: number | null): string {
  if (mps == null || !Number.isFinite(mps) || mps < 0) return '--';
  return `${(mps * 3.6).toFixed(1)} ${i18n.t('units.kmh')}`;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** 8-point cardinal direction for a heading in degrees clockwise from north. */
export function cardinal(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return i18n.t(`units.cardinals.${CARDINALS[i]}`);
}

/** Heading formatted as `NE 45°`, or `--` if unavailable. */
export function formatHeading(deg: number | null): string {
  if (deg == null || !Number.isFinite(deg) || deg < 0) return '--';
  return `${cardinal(deg)} ${Math.round(deg)}°`;
}

/** Warning color shared with the danger/alert UI. */
export const WARNING_COLOR = '#E5484D';

export interface GpsQuality {
  label: string;
  tint?: string;
}

/** Maps GPS horizontal accuracy (m) to a Good/Fair/Poor quality label. */
export function formatGpsQuality(accuracyM: number | null): GpsQuality {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0) {
    return { label: '--' };
  }
  if (accuracyM <= 10) return { label: i18n.t('units.gpsGood') };
  if (accuracyM <= 25) return { label: i18n.t('units.gpsFair') };
  return { label: i18n.t('units.gpsPoor'), tint: WARNING_COLOR };
}

/** Compact duration as `Xh Ym`, `Ym`, or `<1m` for short spans. */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
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
