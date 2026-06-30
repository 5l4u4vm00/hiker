import poiSeed from '@/data/pois.json';

import { createId, getDatabase } from './client';
import type { Poi, WaypointType } from './types';

interface PoiRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  elevation: number | null;
  note: string | null;
}

function mapPoi(row: PoiRow): Poi {
  return {
    id: row.id,
    name: row.name,
    category: row.category as WaypointType,
    lat: row.lat,
    lon: row.lon,
    elevation: row.elevation,
    note: row.note,
  };
}

/** Every curated POI, ordered by name. */
export async function getAllPois(): Promise<Poi[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PoiRow>('SELECT * FROM pois ORDER BY name ASC');
  return rows.map(mapPoi);
}

/**
 * Seeds the bundled POI dataset (`src/data/pois.json`) into the `pois` table on
 * first run. Guarded by a row count so it never re-inserts duplicates or
 * overwrites edits; called once at startup (see `_layout.tsx`).
 */
export async function seedPoisIfEmpty(): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM pois');
  if ((row?.count ?? 0) > 0) return;

  const seed = poiSeed as Omit<Poi, 'id'>[];
  // Exclusive transaction: this seed runs at startup alongside other DB work
  // (route seeding, recording restore, the background location task) on the
  // shared connection, so a plain transaction risks colliding with another
  // open transaction. Queries inside must run on the provided `txn`.
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const poi of seed) {
      await txn.runAsync(
        'INSERT INTO pois (id, name, category, lat, lon, elevation, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        createId(),
        poi.name,
        poi.category,
        poi.lat,
        poi.lon,
        poi.elevation ?? null,
        poi.note ?? null,
      );
    }
  });
}
