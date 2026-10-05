import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { File } from 'expo-file-system';

/**
 * The moler server (EAS Hosting) that turns recordings into text with Google Cloud Speech.
 * Both values are inlined at build time from .env.local; the Google key itself stays on the server.
 */
const SERVER_URL = (process.env.EXPO_PUBLIC_SPEECH_SERVER_URL ?? '').replace(/\/+$/, '');
const SERVER_TOKEN = process.env.EXPO_PUBLIC_SPEECH_SERVER_TOKEN ?? '';

export const isCloudSpeechConfigured = SERVER_URL !== '' && SERVER_TOKEN !== '';

/**
 * Records AMR-WB at 16 kHz on Android: Google Cloud Speech reads it directly,
 * while the default AAC/m4a recording isn't an accepted format
 */
export const CLOUD_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.amr',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 23850,
  android: {
    extension: '.amr',
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: 16000,
  },
};

/** Sends a finished AMR-WB recording to the moler server and returns the recognized text */
export async function transcribeRecording(
  uri: string,
  durationMs: number | null,
  languageCode: string
): Promise<string> {
  const audio = await new File(uri).base64();
  const response = await fetch(`${SERVER_URL}/api/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVER_TOKEN}`,
    },
    body: JSON.stringify({ audio, durationMs, languageCode }),
  });
  const body: { text?: string; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `The speech server returned HTTP ${response.status}`);
  }
  return body.text ?? '';
}
