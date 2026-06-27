import * as SunCalc from 'suncalc';

/** Remaining daylight below this (ms, 1 hour) is flagged as low for safety. */
const LOW_DAYLIGHT_MS = 60 * 60 * 1000;

export interface DaylightInfo {
  /** Sunset time for the given day/location (epoch ms). */
  sunsetMs: number;
  /** Time left until sunset (ms); negative once the sun has set. */
  remainingMs: number;
  /** True when daylight is positive but under an hour. */
  isLow: boolean;
}

/**
 * Computes sunset and remaining daylight for a coordinate, entirely on-device
 * (no network). Returns null if the location has no sunset that day (polar
 * day/night), which SunCalc reports as an invalid Date.
 */
export function daylight(lat: number, lon: number, now: number = Date.now()): DaylightInfo | null {
  const { sunset } = SunCalc.getTimes(new Date(now), lat, lon);
  const sunsetMs = sunset?.getTime() ?? NaN;
  if (!Number.isFinite(sunsetMs)) return null;
  const remainingMs = sunsetMs - now;
  return {
    sunsetMs,
    remainingMs,
    isLow: remainingMs > 0 && remainingMs < LOW_DAYLIGHT_MS,
  };
}

/** Local clock time as `HH:MM` (24-hour). */
export function formatClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
