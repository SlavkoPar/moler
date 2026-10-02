import { File, Paths } from 'expo-file-system';

import type { VoiceMessage } from '@/db/calls';

const MIME_BY_EXTENSION: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  '3gp': 'audio/3gpp',
  caf: 'audio/x-caf',
  wav: 'audio/wav',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/3gpp': '3gp',
  'audio/x-caf': 'caf',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

/** Reads a finished recording so it can be stored in the database */
export async function readRecording(uri: string): Promise<Pick<VoiceMessage, 'data' | 'mimeType'>> {
  const extension = uri.split('.').pop()?.toLowerCase() ?? '';
  const data = await new File(uri).bytes();
  return { data, mimeType: MIME_BY_EXTENSION[extension] ?? 'audio/mp4' };
}

/** Only browsers can end up with undecodable recordings; phone recordings are always playable */
export async function canPlay(_uri: string): Promise<boolean> {
  return true;
}

/** Writes stored audio to a cache file the player can open */
export function toPlayableUri(voice: VoiceMessage, key: string | number): string {
  const extension = EXTENSION_BY_MIME[voice.mimeType.split(';')[0]] ?? 'm4a';
  const file = new File(Paths.cache, `voice-${key}.${extension}`);
  if (file.exists) file.delete();
  file.create();
  file.write(voice.data);
  return file.uri;
}
