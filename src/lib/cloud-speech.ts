import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { File } from 'expo-file-system';

import { callServer, isServerConfigured } from '@/lib/moler-server';

/** The moler server turns recordings into text with Google Cloud Speech */
export const isCloudSpeechConfigured = isServerConfigured;

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
  const { text } = await callServer<{ text?: string }>('/api/transcribe', {
    method: 'POST',
    body: { audio, durationMs, languageCode },
  });
  return text ?? '';
}
