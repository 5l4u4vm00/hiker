/**
 * Elevation lookup backed by Open-Meteo (https://open-meteo.com/en/docs/elevation-api).
 * Free, keyless, and CORS-friendly. Used while planning a route to turn the
 * tapped `[lon, lat]` vertices into elevations so ascent and the time estimate
 * can be computed. Like the weather client, it never throws — any failure
 * (offline, timeout, bad payload) resolves to null and the UI degrades to a
 * distance-only estimate.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/elevation';

const FETCH_TIMEOUT_MS = 8000;

/** Open-Meteo accepts up to 100 coordinates per request. */
const MAX_BATCH = 100;

interface ElevationResponse {
  elevation?: number[];
}

/** Fetches elevations (m) for one batch of `[lon, lat]` coords, or null on failure. */
async function fetchBatch(coords: [number, number][]): Promise<number[] | null> {
  const lats = coords.map((c) => c[1].toFixed(5)).join(',');
  const lons = coords.map((c) => c[0].toFixed(5)).join(',');
  const url = `${ENDPOINT}?latitude=${lats}&longitude=${lons}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[elevation] HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as ElevationResponse;
    const elevations = json.elevation;
    if (!Array.isArray(elevations) || elevations.length !== coords.length) return null;
    return elevations;
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.warn(`[elevation] ${aborted ? 'timeout' : 'request failed'}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches elevations (m) for an ordered list of `[lon, lat]` coordinates,
 * preserving order. Longer lists are chunked into ≤100-coord requests sent
 * sequentially to respect the free tier. Returns null if any chunk fails so the
 * caller can fall back to a distance-only estimate.
 */
export async function fetchElevations(coords: [number, number][]): Promise<number[] | null> {
  if (coords.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += MAX_BATCH) {
    const batch = coords.slice(i, i + MAX_BATCH);
    const result = await fetchBatch(batch);
    if (!result) return null;
    out.push(...result);
  }
  return out;
}
