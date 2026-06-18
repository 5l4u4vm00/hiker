import { countRoutes, upsertRoute } from '@/db/routes';
import type { RouteDifficulty, RouteSource } from '@/db/types';

interface SeedRoute {
  key: string;
  name: string;
  region: string;
  difficulty: RouteDifficulty;
  distanceM: number;
  ascentM: number;
  coordinates: [number, number][];
}

/**
 * A small set of well-known Taiwan hiking routes so the discovery screen has
 * content on first launch. Geometries are simplified samples; real data can be
 * imported from GPX or sourced from OpenStreetMap later.
 */
const SEED_ROUTES: SeedRoute[] = [
  {
    key: 'yushan-main-peak',
    name: 'Yushan Main Peak',
    region: 'Yushan National Park',
    difficulty: 'hard',
    distanceM: 22000,
    ascentM: 1400,
    coordinates: [
      [120.9098, 23.4882],
      [120.9405, 23.4795],
      [120.9572, 23.4707],
      [120.9571, 23.4702],
    ],
  },
  {
    key: 'xueshan-main-peak',
    name: 'Xueshan Main Peak',
    region: 'Shei-Pa National Park',
    difficulty: 'hard',
    distanceM: 21000,
    ascentM: 1800,
    coordinates: [
      [121.2603, 24.3899],
      [121.2533, 24.3987],
      [121.2371, 24.3845],
      [121.2306, 24.3841],
    ],
  },
  {
    key: 'hehuan-main-peak',
    name: 'Hehuanshan Main Peak',
    region: 'Taroko National Park',
    difficulty: 'easy',
    distanceM: 4600,
    ascentM: 220,
    coordinates: [
      [121.2785, 24.1411],
      [121.2731, 24.1389],
      [121.2706, 24.1357],
    ],
  },
  {
    key: 'qixingshan',
    name: 'Qixingshan (Seven Star Mountain)',
    region: 'Yangmingshan National Park',
    difficulty: 'moderate',
    distanceM: 6400,
    ascentM: 560,
    coordinates: [
      [121.5436, 25.1741],
      [121.5491, 25.1772],
      [121.5552, 25.1801],
    ],
  },
];

/** Inserts the sample routes if the routes table is empty. */
export async function seedRoutesIfEmpty(): Promise<void> {
  const existing = await countRoutes();
  if (existing > 0) return;

  for (const seed of SEED_ROUTES) {
    await upsertRoute(
      {
        name: seed.name,
        region: seed.region,
        difficulty: seed.difficulty,
        distanceM: seed.distanceM,
        ascentM: seed.ascentM,
        source: 'osm' as RouteSource,
        geometry: { type: 'LineString', coordinates: seed.coordinates },
      },
      seed.key,
    );
  }
}
