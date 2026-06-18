import { OfflineManager, type LngLatBounds } from '@maplibre/maplibre-react-native';

import { OSM_STYLE_JSON } from '@/map/mapStyle';

/**
 * Predefined regions a hiker can download for offline use. Bounds are
 * [west, south, east, north] in WGS84 degrees, covering popular Taiwan hiking
 * areas. Zoom is capped to keep pack sizes reasonable.
 */
export interface OfflineRegionPreset {
  key: string;
  name: string;
  bounds: LngLatBounds;
  minZoom: number;
  maxZoom: number;
}

export const OFFLINE_PRESETS: OfflineRegionPreset[] = [
  {
    key: 'yushan',
    name: 'Yushan (Jade Mountain)',
    bounds: [120.88, 23.4, 121.06, 23.55],
    minZoom: 10,
    maxZoom: 15,
  },
  {
    key: 'xueshan',
    name: 'Xueshan (Snow Mountain)',
    bounds: [121.18, 24.33, 121.32, 24.45],
    minZoom: 10,
    maxZoom: 15,
  },
  {
    key: 'hehuanshan',
    name: 'Hehuanshan',
    bounds: [121.24, 24.11, 121.32, 24.2],
    minZoom: 10,
    maxZoom: 15,
  },
  {
    key: 'yangmingshan',
    name: 'Yangmingshan',
    bounds: [121.5, 25.13, 121.61, 25.21],
    minZoom: 10,
    maxZoom: 15,
  },
];

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
  return new Promise((resolve, reject) => {
    OfflineManager.createPack(
      {
        mapStyle: OSM_STYLE_JSON,
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
