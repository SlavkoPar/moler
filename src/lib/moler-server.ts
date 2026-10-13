/**
 * The moler server on EAS Hosting (speech-to-text, Google Drive import). The URL and token are
 * inlined at build time from .env.local / EAS environment variables; Google keys stay on the server.
 */
const SERVER_URL = (process.env.EXPO_PUBLIC_SPEECH_SERVER_URL ?? '').replace(/\/+$/, '');
const SERVER_TOKEN = process.env.EXPO_PUBLIC_SPEECH_SERVER_TOKEN ?? '';

export const isServerConfigured = SERVER_URL !== '' && SERVER_TOKEN !== '';

/** Calls an API route of the moler server and returns its JSON, or throws the server's error message */
export async function callServer<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVER_TOKEN}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `The moler server returned HTTP ${response.status}`);
  }
  return body;
}
