/**
 * Current-weather lookup backed by Open-Meteo (https://open-meteo.com).
 * Free, keyless, and CORS-friendly. This is the app's one online touch point
 * for recording: a single snapshot fetched at the start of a hike. It never
 * throws — any failure (offline, timeout, bad payload) resolves to null and the
 * UI simply shows "--".
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const FETCH_TIMEOUT_MS = 8000;

export interface WeatherSnapshot {
  /** Air temperature (°C). */
  tempC: number;
  /** WMO weather interpretation code. */
  code: number;
  /** When the snapshot was fetched (epoch ms). */
  fetchedAt: number;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
}

/** Fetches the current weather for a coordinate, or null on any failure. */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const url =
    `${ENDPOINT}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,weather_code`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[weather] HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as OpenMeteoResponse;
    const temp = json.current?.temperature_2m;
    const code = json.current?.weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') return null;
    return { tempC: temp, code, fetchedAt: Date.now() };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.warn(`[weather] ${aborted ? 'timeout' : 'request failed'}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
