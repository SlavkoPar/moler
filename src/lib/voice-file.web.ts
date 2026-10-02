import type { VoiceMessage } from '@/db/calls';

// Browsers record into a temporary blob: URL, so the audio is copied into the database as bytes
let lastObjectUrl: string | null = null;

/** Reads a finished recording so it can be stored in the database */
export async function readRecording(uri: string): Promise<Pick<VoiceMessage, 'data' | 'mimeType'>> {
  const blob = await (await fetch(uri)).blob();
  return { data: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || 'audio/webm' };
}

/**
 * Checks that the browser can decode the audio. An empty or broken recording would otherwise
 * fail later on Play with "Failed to load because no supported source was found".
 */
export function canPlay(uri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (playable: boolean) => {
      clearTimeout(timeout);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      resolve(playable);
    };
    // If the browser takes unusually long, don't block the user
    const timeout = setTimeout(() => finish(true), 5000);
    audio.onloadedmetadata = () => finish(true);
    audio.onerror = () => finish(false);
    audio.preload = 'metadata';
    audio.src = uri;
  });
}

/** Turns stored audio into a URL the player can open; only the latest one is kept alive */
export function toPlayableUri(voice: VoiceMessage, _key: string | number): string {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(new Blob([voice.data as BlobPart], { type: voice.mimeType }));
  return lastObjectUrl;
}
