import { File } from 'expo-file-system';
import { XMLParser } from 'fast-xml-parser';

import { type RouteInput, upsertRoute } from '@/db/routes';
import type { Route } from '@/db/types';
import { ascentFromElevations, haversine } from '@/tracking/stats';

interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
}

interface RawTrkpt {
  '@_lat': string;
  '@_lon': string;
  ele?: string | number;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function collectPoints(node: unknown): GpxPoint[] {
  const points: GpxPoint[] = [];

  const visit = (obj: Record<string, unknown>) => {
    // Track points live under trk > trkseg > trkpt; routes under rte > rtept.
    const trks = toArray(obj.trk as Record<string, unknown> | Record<string, unknown>[]);
    for (const trk of trks) {
      for (const seg of toArray(trk.trkseg as Record<string, unknown> | Record<string, unknown>[])) {
        for (const pt of toArray(seg.trkpt as RawTrkpt | RawTrkpt[])) {
          pushPoint(points, pt);
        }
      }
    }
    for (const rte of toArray(obj.rte as Record<string, unknown> | Record<string, unknown>[])) {
      for (const pt of toArray(rte.rtept as RawTrkpt | RawTrkpt[])) {
        pushPoint(points, pt);
      }
    }
  };

  if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
  }
  return points;
}

function pushPoint(points: GpxPoint[], pt: RawTrkpt): void {
  const lat = Number(pt['@_lat']);
  const lon = Number(pt['@_lon']);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return;
  const ele = pt.ele != null ? Number(pt.ele) : null;
  points.push({ lat, lon, ele: ele != null && !Number.isNaN(ele) ? ele : null });
}

function computeGeometryStats(points: GpxPoint[]): { distanceM: number; ascentM: number } {
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) distanceM += haversine(points[i - 1], points[i]);
  const ascentM = ascentFromElevations(points.map((p) => p.ele));
  return { distanceM, ascentM };
}

/** Parses a GPX document string into a route ready to be persisted. */
export function parseGpxToRoute(xml: string, fallbackName: string): RouteInput {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml) as { gpx?: Record<string, unknown> };
  const gpx = parsed.gpx ?? {};

  const points = collectPoints(gpx);
  if (points.length < 2) {
    throw new Error('GPX file contains no usable track or route points.');
  }

  const metadata = gpx.metadata as { name?: string } | undefined;
  const trk = toArray(gpx.trk as Record<string, unknown> | Record<string, unknown>[])[0];
  const name =
    (trk?.name as string | undefined) || metadata?.name || fallbackName;

  const { distanceM, ascentM } = computeGeometryStats(points);

  return {
    name,
    region: 'Taiwan',
    difficulty: null,
    distanceM,
    ascentM,
    source: 'gpx',
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lon, p.lat]),
    },
  };
}

/** Opens the file picker, parses the chosen GPX, and saves it as a route. */
export async function importGpxFromPicker(): Promise<Route | null> {
  const picked = await File.pickFileAsync({});
  if (picked.canceled || !picked.result) return null;
  const xml = await picked.result.text();
  const route = parseGpxToRoute(xml, picked.result.name.replace(/\.gpx$/i, ''));
  return upsertRoute(route);
}
