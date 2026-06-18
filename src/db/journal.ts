import { createId, getDatabase } from './client';
import type { JournalEntry } from './types';

interface JournalRow {
  id: string;
  track_id: string;
  note: string;
  photo_uris: string;
  created_at: number;
}

function mapEntry(row: JournalRow): JournalEntry {
  let photoUris: string[] = [];
  try {
    photoUris = JSON.parse(row.photo_uris) as string[];
  } catch {
    photoUris = [];
  }
  return {
    id: row.id,
    trackId: row.track_id,
    note: row.note,
    photoUris,
    createdAt: row.created_at,
  };
}

export async function addJournalEntry(
  trackId: string,
  note: string,
  photoUris: string[] = [],
): Promise<JournalEntry> {
  const db = await getDatabase();
  const id = createId();
  const createdAt = Date.now();
  await db.runAsync(
    'INSERT INTO journal_entries (id, track_id, note, photo_uris, created_at) VALUES (?, ?, ?, ?, ?)',
    id,
    trackId,
    note,
    JSON.stringify(photoUris),
    createdAt,
  );
  return { id, trackId, note, photoUris, createdAt };
}

export async function getJournalEntries(trackId: string): Promise<JournalEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<JournalRow>(
    'SELECT * FROM journal_entries WHERE track_id = ? ORDER BY created_at DESC',
    trackId,
  );
  return rows.map(mapEntry);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM journal_entries WHERE id = ?', id);
}
