import { createId, getDatabase } from './client';
import type { Track, TrackPoint, TrackPointInput, TrackStatus } from './types';

interface TrackRow {
  id: string;
  name: string;
  started_at: number;
  ended_at: number | null;
  distance_m: number;
  ascent_m: number;
  descent_m: number;
  duration_s: number;
  max_alt: number | null;
  status: string;
  route_id: string | null;
  weather_temp_c: number | null;
  weather_code: number | null;
  weather_fetched_at: number | null;
}

interface TrackPointRow {
  id: number;
  track_id: string;
  lat: number;
  lon: number;
  alt: number | null;
  accuracy: number | null;
  speed: number | null;
  recorded_at: number;
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceM: row.distance_m,
    ascentM: row.ascent_m,
    descentM: row.descent_m,
    durationS: row.duration_s,
    maxAlt: row.max_alt,
    status: row.status as TrackStatus,
    routeId: row.route_id,
    weatherTempC: row.weather_temp_c,
    weatherCode: row.weather_code,
    weatherFetchedAt: row.weather_fetched_at,
  };
}

function mapPoint(row: TrackPointRow): TrackPoint {
  return {
    id: row.id,
    trackId: row.track_id,
    lat: row.lat,
    lon: row.lon,
    alt: row.alt,
    accuracy: row.accuracy,
    speed: row.speed,
    recordedAt: row.recorded_at,
  };
}

export async function createTrack(name: string, routeId?: string | null): Promise<Track> {
  const db = await getDatabase();
  const id = createId();
  const startedAt = Date.now();
  await db.runAsync(
    'INSERT INTO tracks (id, name, started_at, status, route_id) VALUES (?, ?, ?, ?, ?)',
    id,
    name,
    startedAt,
    'recording',
    routeId ?? null,
  );
  return {
    id,
    name,
    startedAt,
    endedAt: null,
    distanceM: 0,
    ascentM: 0,
    descentM: 0,
    durationS: 0,
    maxAlt: null,
    status: 'recording',
    routeId: routeId ?? null,
    weatherTempC: null,
    weatherCode: null,
    weatherFetchedAt: null,
  };
}

export async function getTrack(id: string): Promise<Track | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrackRow>('SELECT * FROM tracks WHERE id = ?', id);
  return row ? mapTrack(row) : null;
}

/** Most recently started track that has not been completed, if any. */
export async function getActiveTrack(): Promise<Track | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrackRow>(
    "SELECT * FROM tracks WHERE status != 'completed' ORDER BY started_at DESC LIMIT 1",
  );
  return row ? mapTrack(row) : null;
}

export async function listCompletedTracks(): Promise<Track[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrackRow>(
    "SELECT * FROM tracks WHERE status = 'completed' ORDER BY started_at DESC",
  );
  return rows.map(mapTrack);
}

/** A completed track enriched with its journal note metadata, for the Journal list. */
export interface JournalTrack {
  track: Track;
  noteCount: number;
  latestNote: string | null;
}

interface JournalTrackRow extends TrackRow {
  note_count: number;
  latest_note: string | null;
}

/**
 * Lists completed tracks with their note count and latest note. When `keyword`
 * is provided, matches the track name or the text of any attached journal note.
 */
export async function queryJournalTracks(keyword?: string): Promise<JournalTrack[]> {
  const db = await getDatabase();
  const trimmed = keyword?.trim() ?? '';
  let sql =
    `SELECT t.*,
       (SELECT COUNT(*) FROM journal_entries je WHERE je.track_id = t.id) AS note_count,
       (SELECT je.note FROM journal_entries je WHERE je.track_id = t.id
          ORDER BY je.created_at DESC LIMIT 1) AS latest_note
     FROM tracks t
     WHERE t.status = 'completed'`;
  const params: string[] = [];
  if (trimmed) {
    const like = `%${trimmed}%`;
    sql +=
      ` AND (t.name LIKE ? OR EXISTS (
           SELECT 1 FROM journal_entries je WHERE je.track_id = t.id AND je.note LIKE ?))`;
    params.push(like, like);
  }
  sql += ' ORDER BY t.started_at DESC';
  const rows = await db.getAllAsync<JournalTrackRow>(sql, ...params);
  return rows.map((row) => ({
    track: mapTrack(row),
    noteCount: row.note_count,
    latestNote: row.latest_note,
  }));
}

export type TrackStats = Pick<
  Track,
  'distanceM' | 'ascentM' | 'descentM' | 'durationS' | 'maxAlt'
>;

export async function updateTrackStats(id: string, stats: TrackStats): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE tracks SET distance_m = ?, ascent_m = ?, descent_m = ?, duration_s = ?, max_alt = ? WHERE id = ?',
    stats.distanceM,
    stats.ascentM,
    stats.descentM,
    stats.durationS,
    stats.maxAlt,
    id,
  );
}

export async function setTrackStatus(id: string, status: TrackStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE tracks SET status = ? WHERE id = ?', status, id);
}

export async function finishTrack(id: string, stats: TrackStats): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE tracks SET status = ?, ended_at = ?, distance_m = ?, ascent_m = ?, descent_m = ?, duration_s = ?, max_alt = ? WHERE id = ?',
    'completed',
    Date.now(),
    stats.distanceM,
    stats.ascentM,
    stats.descentM,
    stats.durationS,
    stats.maxAlt,
    id,
  );
}

/** Persists a weather snapshot onto a track (fetched at recording start). */
export async function updateTrackWeather(
  id: string,
  weather: { tempC: number; code: number; fetchedAt: number },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE tracks SET weather_temp_c = ?, weather_code = ?, weather_fetched_at = ? WHERE id = ?',
    weather.tempC,
    weather.code,
    weather.fetchedAt,
    id,
  );
}

export async function renameTrack(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE tracks SET name = ? WHERE id = ?', name, id);
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM tracks WHERE id = ?', id);
}

export async function addTrackPoint(point: TrackPointInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO track_points (track_id, lat, lon, alt, accuracy, speed, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    point.trackId,
    point.lat,
    point.lon,
    point.alt,
    point.accuracy,
    point.speed,
    point.recordedAt,
  );
}

/** Inserts many points in a single transaction (used to flush a buffer). */
export async function addTrackPoints(points: TrackPointInput[]): Promise<void> {
  if (points.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        'INSERT INTO track_points (track_id, lat, lon, alt, accuracy, speed, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        p.trackId,
        p.lat,
        p.lon,
        p.alt,
        p.accuracy,
        p.speed,
        p.recordedAt,
      );
    }
  });
}

export async function getTrackPoints(trackId: string): Promise<TrackPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrackPointRow>(
    'SELECT * FROM track_points WHERE track_id = ? ORDER BY recorded_at ASC',
    trackId,
  );
  return rows.map(mapPoint);
}
