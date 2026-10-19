import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { formatCents, getCalls, getVoiceMessage, setUploadResult } from '@/db/calls';
import { getSetting } from '@/db/settings';
import { MOLERS_WEB_URL } from '@/lib/storage-mode';
import { toPlayableUri } from '@/lib/voice-file';

/** API key of the moler Web API, built into the app from .env.local / EAS environment variables */
const API_KEY = process.env.EXPO_PUBLIC_MOLERS_API_KEY ?? '';

/** What online mode needs to send calls; the workspace comes from Settings */
export type MolersAccount = { workspace: string; apiKey: string };

export async function getMolersAccount(db: SQLiteDatabase): Promise<MolersAccount> {
  return { workspace: await getSetting(db, 'workspace'), apiKey: API_KEY };
}

async function errorMessage(response: Response) {
  const text = await response.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    if (body.error || body.message) return `${body.error ?? body.message} (HTTP ${response.status})`;
  } catch {
    // Not JSON; fall through to the plain text
  }
  return text.trim() ? `${text.trim().slice(0, 200)} (HTTP ${response.status})` : `HTTP ${response.status}`;
}

/**
 * Sends a saved call, with its voice message, to POST /api/calls of the moler Web API and records
 * the outcome on the call. Returns the error message, or null when it was stored online.
 */
export async function uploadCall(db: SQLiteDatabase, callId: number, account: MolersAccount): Promise<string | null> {
  const [call] = await getCalls(db, { id: callId });
  if (!call) return 'The call no longer exists';

  let error: string | null = null;
  try {
    if (!account.apiKey) throw new Error('This app build has no API key for the moler Web API');
    if (!account.workspace) throw new Error('Enter the workspace in Settings');

    const form = new FormData();
    const fields: Record<string, string | number | boolean | null> = {
      workSpace: account.workspace,
      phone: call.phone,
      calledAt: call.calledAt,
      name: call.name,
      address: call.address,
      comment: call.comment,
      price: call.priceCents === null ? null : formatCents(call.priceCents),
      callType: call.callType,
      durationSeconds: call.durationSeconds,
      location: call.location,
      numberLabel: call.numberLabel,
      countryIso: call.countryIso,
      isVideo: call.isVideo,
      voiceMessageMs: call.hasVoice ? call.voiceDurationMs : null,
      transcript: call.transcript,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== '') form.append(key, String(value));
    }

    const voice = call.hasVoice ? await getVoiceMessage(db, call.id) : null;
    if (voice) {
      if (Platform.OS === 'web') {
        form.append('voice', new Blob([voice.data as BlobPart], { type: voice.mimeType }), 'voice');
      } else {
        // Expo's fetch (SDK 57) doesn't accept React Native's { uri, name, type } parts; it reads files
        // that can return their bytes, like expo-file-system's File (name and type come from it)
        const file = new File(toPlayableUri(voice, `upload-${call.id}`));
        form.append('voice', file as unknown as Blob);
      }
    }

    // No Content-Type header: fetch sets multipart/form-data with the boundary itself
    const response = await fetch(`${MOLERS_WEB_URL}/api/calls`, {
      method: 'POST',
      headers: { 'X-API-Key': account.apiKey },
      body: form,
    });
    if (!response.ok) error = await errorMessage(response);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  await setUploadResult(db, call.id, error);
  return error;
}
