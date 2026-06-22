import type { RouteInput } from '@/db/routes';
import type { RouteDifficulty } from '@/db/types';
import { haversine, type LatLon } from '@/tracking/stats';

/**
 * Live route search backed by the Overpass API (OpenStreetMap). Queries hiking
 * route relations, assembles their member ways into a single LineString, and
 * maps them into the app's RouteInput shape. Results are transient — callers
 * persist a chosen one via `saveOverpassRoute` in routeService.
 */

/**
 * Keyless public Overpass mirrors, tried in order on failure / rate limiting.
 * All must be full instances that return member geometry for `out geom`
 * (proxies like maps.mail.ru return tags only and are unusable here). To swap
 * these, edit this list directly — do not move it to `expo.extra`, since
 * `Constants.expoConfig` is frozen at native build time and would not pick up
 * changes without a full rebuild.
 */
const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Matches the `[timeout:25]` in the QL so the client gives the server room to answer. */
const FETCH_TIMEOUT_MS = 25000;

/** Cap relation count so payloads and pack sizes stay reasonable. */
const RESULT_LIMIT = 60;

/** Default radius for a "near me" search; clamped to MAX_RADIUS_M. */
const DEFAULT_RADIUS_M = 10000;
const MAX_RADIUS_M = 30000;

/**
 * Bounding box covering Taiwan and its outlying islands as `south,west,north,east`.
 * Used instead of an `area["ISO3166-1"="TW"]` lookup, which is far slower on public
 * Overpass mirrors and often exceeds the request timeout.
 */
const TAIWAN_BBOX = '21.5,118.1,26.4,122.3';

/** Lines longer than this are down-sampled before storing to keep SQLite/map light. */
const MAX_LINE_POINTS = 2000;

/** A search hit: a RouteInput plus its stable osm key, not yet persisted. */
export interface OverpassRouteResult extends RouteInput {
  /** Stable identifier `osm-relation-<id>`, used as the SQLite primary key. */
  key: string;
}

export interface OverpassQueryError {
  kind: 'network' | 'rate-limit' | 'server';
}

export type OverpassResult =
  | { ok: true; results: OverpassRouteResult[] }
  | { ok: false; error: OverpassQueryError };

/** Searches hiking routes whose name matches `keyword` (case-insensitive) within Taiwan. */
export function searchRoutesByName(keyword: string): Promise<OverpassResult> {
  return runOverpass(buildNameQuery(keyword));
}

/** Searches hiking routes within `radiusM` of a coordinate. */
export function searchRoutesNearby(
  center: LatLon,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<OverpassResult> {
  const radius = Math.min(Math.max(radiusM, 1), MAX_RADIUS_M);
  return runOverpass(buildAroundQuery(center, radius));
}

// --- Query builders -------------------------------------------------------

/** Escapes regex metacharacters so user input is matched literally inside `~"…"`. */
function escapeRegex(input: string): string {
  return input.replace(/[\\.*+?()[\]{}|^$]/g, '\\$&');
}

function buildNameQuery(keyword: string): string {
  const safe = escapeRegex(keyword.trim());
  // Match the localized `name` (Chinese for most Taiwan trails) or the English
  // `name:en`; duplicate relations are de-duplicated by id in the parser.
  return `[out:json][timeout:25];
(
  relation["route"~"hiking|foot"]["name"~"${safe}",i](${TAIWAN_BBOX});
  relation["route"~"hiking|foot"]["name:en"~"${safe}",i](${TAIWAN_BBOX});
);
out geom ${RESULT_LIMIT};`;
}

function buildAroundQuery(center: LatLon, radiusM: number): string {
  return `[out:json][timeout:25];
( relation["route"~"hiking|foot"](around:${radiusM},${center.lat},${center.lon}); );
out geom ${RESULT_LIMIT};`;
}

// --- Network --------------------------------------------------------------

/**
 * Runs an Overpass QL query, rotating through the mirrors until one answers.
 * Network/timeout failures map to `network`, 429/504 to `rate-limit`, other
 * non-OK responses to `server`. Never throws.
 */
async function runOverpass(ql: string): Promise<OverpassResult> {
  let lastError: OverpassQueryError = { kind: 'network' };

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as unknown;
        return { ok: true, results: parseOverpassRelations(json) };
      }
      // 429 (rate limited) and 504 (gateway timeout) are worth retrying elsewhere.
      lastError = res.status === 429 || res.status === 504 ? { kind: 'rate-limit' } : { kind: 'server' };
      console.warn(`[overpass] ${endpoint} -> HTTP ${res.status} (${lastError.kind})`);
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      lastError = { kind: 'network' };
      console.warn(`[overpass] ${endpoint} -> ${aborted ? 'timeout' : 'request failed'}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: lastError };
}

// --- Parsing & geometry assembly -----------------------------------------

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassMember {
  type?: string;
  geometry?: OverpassNode[];
}

interface OverpassRelation {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
}

/**
 * Maps OSM `sac_scale` to the app's coarse difficulty scale; unknown/missing
 * scales return null (the UI renders that as "--").
 */
const SAC_SCALE_DIFFICULTY: Record<string, RouteDifficulty> = {
  hiking: 'easy',
  mountain_hiking: 'moderate',
  demanding_mountain_hiking: 'moderate',
  alpine_hiking: 'hard',
  demanding_alpine_hiking: 'expert',
  difficult_alpine_hiking: 'expert',
};

function mapDifficulty(tags: Record<string, string>): RouteDifficulty | null {
  return SAC_SCALE_DIFFICULTY[tags.sac_scale] ?? null;
}

const KEY_PREC = 6; // ~0.1 m, enough to detect shared endpoints between ways.

function coordKey(p: OverpassNode): string {
  return `${p.lat.toFixed(KEY_PREC)},${p.lon.toFixed(KEY_PREC)}`;
}

/**
 * Greedily stitches member ways into one ordered point chain. Ways may be out
 * of order or reversed, so we match each candidate against the current chain's
 * head/tail and reverse it as needed. This is a pragmatic approximation (it can
 * mis-order genuinely branched relations) but is sufficient for display,
 * distance, and proximity. Unconnectable remainders are appended as-is.
 */
function stitchWays(ways: OverpassNode[][]): OverpassNode[] {
  if (ways.length === 0) return [];
  if (ways.length === 1) return ways[0];

  const remaining = ways.slice();
  const chain = remaining.shift()!.slice();
  let progress = true;

  while (remaining.length > 0 && progress) {
    progress = false;
    const tail = chain[chain.length - 1];
    const head = chain[0];

    for (let i = 0; i < remaining.length; i++) {
      const w = remaining[i];
      const ws = w[0];
      const we = w[w.length - 1];

      if (coordKey(ws) === coordKey(tail) || coordKey(we) === coordKey(tail)) {
        const seg = coordKey(ws) === coordKey(tail) ? w : w.slice().reverse();
        chain.push(...seg.slice(1)); // drop the shared seam point
        remaining.splice(i, 1);
        progress = true;
        break;
      }
      if (coordKey(ws) === coordKey(head) || coordKey(we) === coordKey(head)) {
        const seg = coordKey(we) === coordKey(head) ? w : w.slice().reverse();
        chain.unshift(...seg.slice(0, -1));
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  for (const w of remaining) chain.push(...w); // accept gaps for unconnectable ways
  return chain;
}

/** Keeps every Nth point so very long relations stay light without losing shape. */
function downsample(points: OverpassNode[]): OverpassNode[] {
  if (points.length <= MAX_LINE_POINTS) return points;
  const step = Math.ceil(points.length / MAX_LINE_POINTS);
  const out = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function distanceOf(points: OverpassNode[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/**
 * Parses an Overpass JSON response into route results. Pure and testable —
 * relations without a name or with fewer than two stitched points are skipped,
 * and duplicate relation ids are de-duplicated.
 */
export function parseOverpassRelations(json: unknown): OverpassRouteResult[] {
  if (typeof json !== 'object' || json === null) return [];
  const elements = (json as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const results: OverpassRouteResult[] = [];

  for (const raw of elements as OverpassRelation[]) {
    if (raw.type !== 'relation' || typeof raw.id !== 'number') continue;
    const tags = raw.tags ?? {};
    const name = tags.name ?? tags['name:zh'] ?? tags['name:en'];
    if (!name) continue;

    const key = `osm-relation-${raw.id}`;
    if (seen.has(key)) continue;

    const ways = (raw.members ?? [])
      .filter((m): m is OverpassMember & { geometry: OverpassNode[] } =>
        m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 0,
      )
      .map((m) => m.geometry);

    const stitched = downsample(stitchWays(ways));
    if (stitched.length < 2) continue;

    const computed = distanceOf(stitched);
    const tagged = Number(tags.distance);
    const distanceM = computed > 0 ? computed : Number.isFinite(tagged) ? tagged * 1000 : 0;

    seen.add(key);
    results.push({
      key,
      name,
      region: tags['addr:city'] ?? tags.region ?? tags.operator ?? 'Taiwan',
      difficulty: mapDifficulty(tags),
      distanceM,
      ascentM: 0, // Overpass carries no elevation profile.
      source: 'osm',
      geometry: { type: 'LineString', coordinates: stitched.map((p) => [p.lon, p.lat]) },
    });
  }

  return results;
}
