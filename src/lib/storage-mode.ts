import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';

/**
 * Where calls are stored:
 * - "offline": in the local database on this phone (best for a single user)
 * - "online": also sent to the moler Web API, into a shared workspace (best for several users).
 *   The call is still kept on the phone, so the list, exports and voice playback keep working.
 */
export type StorageMode = 'offline' | 'online';

/** Website where users register a workspace for online mode */
export const MOLERS_WEB_URL = 'https://molers.onrender.com';


export async function getStorageMode(db: SQLiteDatabase): Promise<StorageMode> {
  return (await getSetting(db, 'storageMode')) === 'online' ? 'online' : 'offline';
}

export async function setStorageMode(db: SQLiteDatabase, mode: StorageMode) {
  await setSetting(db, 'storageMode', mode);
}
