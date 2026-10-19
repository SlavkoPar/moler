import type { SQLiteDatabase } from 'expo-sqlite';

/** Keys of the small key/value settings stored in the database */
export type SettingKey =
  /** "Your name or e-mail" on the Exports tab */
  | 'exporterName'
  /** Folder the last import was read from, to import from it again without picking */
  | 'importFolderUri'
  /** Link of the Google Drive folder to import from */
  | 'driveFolderLink'
  /** Where calls are stored: "offline" (this phone) or "online" (Web API), see src/lib/storage-mode.ts */
  | 'storageMode'
  /** Workspace registered at the moler website, used in online mode */
  | 'workspace';

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
