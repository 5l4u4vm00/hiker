import { createId, getDatabase } from './client';
import type { EmergencyContact } from './types';

export async function listContacts(): Promise<EmergencyContact[]> {
  const db = await getDatabase();
  return db.getAllAsync<EmergencyContact>(
    'SELECT id, name, phone FROM emergency_contacts ORDER BY name ASC',
  );
}

export async function addContact(name: string, phone: string): Promise<EmergencyContact> {
  const db = await getDatabase();
  const id = createId();
  await db.runAsync(
    'INSERT INTO emergency_contacts (id, name, phone) VALUES (?, ?, ?)',
    id,
    name,
    phone,
  );
  return { id, name, phone };
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM emergency_contacts WHERE id = ?', id);
}
