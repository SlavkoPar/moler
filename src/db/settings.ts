import type { SQLiteDatabase } from 'expo-sqlite';

/** Keys of the small key/value settings stored in the database */
export type SettingKey = 'exporterName';

export async function getSetting(db: SQLiteDatabase, key: SettingKey): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? '';
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
