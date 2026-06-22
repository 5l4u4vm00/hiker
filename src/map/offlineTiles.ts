import { OfflineManager, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { File, Paths } from 'expo-file-system';

import { MAP_STYLE_JSON } from '@/map/mapStyle';

/**
 * MapLibre's offline downloader takes a style *URL*, not an inline style object
 * (iOS does `[NSURL URLWithString:mapStyle]`, Android `OfflineTilePyramidRegionDefinition(mapStyle, …)`).
 * Passing serialized style JSON yields a nil URL and MapLibre silently falls
 * back to its default demo style, then crashes the process while downloading it.
 * So we persist the style to a local file and hand the downloader its `file://`
 * URI; MapLibre's file source loads it and downloads the tiles its sources name.
 */
function offlineStyleUri(): string {
  const file = new File(Paths.cache, 'offline-style.json');
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(MAP_STYLE_JSON);
  return file.uri;
}

/**
 * A bounded tile pack to download for offline use. Bounds are
 * [west, south, east, north] in WGS84 degrees; zoom is capped to keep pack
 * sizes reasonable.
 */
export interface OfflineRegionPreset {
  key: string;
  name: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
}

/** Padding (degrees) added around a route's bounding box so the area isn't clipped at the edges. */
const ROUTE_BBOX_PADDING_DEG = 0.01;

/**
 * Builds a downloadable tile pack covering a route's geometry, keyed `route-<id>`
 * so the route detail screen can detect and delete it. Returns null when the
 * route has no coordinates. `coords` are GeoJSON `[lon, lat]` pairs.
 */
export function regionForRoute(
  id: string,
  name: string,
  coords: number[][],
): OfflineRegionPreset | null {
  if (coords.length === 0) return null;
  let [west, south] = coords[0];
  let [east, north] = coords[0];
  for (const [lon, lat] of coords) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const p = ROUTE_BBOX_PADDING_DEG;
  return {
    key: `route-${id}`,
    name,
    bounds: [west - p, south - p, east + p, north + p],
    minZoom: 11,
    maxZoom: 15,
  };
}

export interface DownloadProgress {
  percentage: number;
  completedTileCount: number;
  completedTileSize: number;
}

/**
 * Downloads an offline tile pack for the given region. Calls `onProgress` as the
 * download advances. Resolves when complete, rejects on error.
 */
export function downloadRegion(
  preset: OfflineRegionPreset,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  const mapStyle = offlineStyleUri();
  return new Promise((resolve, reject) => {
    OfflineManager.createPack(
      {
        mapStyle,
        bounds: preset.bounds,
        minZoom: preset.minZoom,
        maxZoom: preset.maxZoom,
        metadata: { key: preset.key, name: preset.name },
      },
      (_pack, status) => {
        onProgress?.({
          percentage: status.percentage,
          completedTileCount: status.completedTileCount,
          completedTileSize: status.completedTileSize,
        });
        if (status.state === 'complete' || status.percentage >= 100) {
          resolve();
        }
      },
      (_pack, error) => {
        reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
      },
    ).catch(reject);
  });
}

export interface DownloadedRegion {
  id: string;
  key: string;
  name: string;
  sizeBytes: number;
  percentage: number;
}

export async function listDownloadedRegions(): Promise<DownloadedRegion[]> {
  const packs = await OfflineManager.getPacks();
  const regions = await Promise.all(
    packs.map(async (pack) => {
      const status = await pack.status();
      return {
        id: pack.id,
        key: String(pack.metadata.key ?? pack.id),
        name: String(pack.metadata.name ?? 'Offline region'),
        sizeBytes: status.completedTileSize,
        percentage: status.percentage,
      };
    }),
  );
  return regions;
}

export async function deleteRegion(id: string): Promise<void> {
  await OfflineManager.deletePack(id);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
