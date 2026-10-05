/**
 * Speech-to-text for phones without a speech service: the app posts a finished AMR-WB recording,
 * this route sends it to Google Cloud Speech-to-Text and returns the text.
 * Runs on EAS Hosting; GOOGLE_SPEECH_API_KEY and SPEECH_API_TOKEN are set with `eas env:create`.
 */

const GOOGLE_API_URL = 'https://speech.googleapis.com/v1';

/** Synchronous recognition only accepts up to a minute of audio; longer messages use an operation */
const SYNC_LIMIT_MS = 55_000;
const POLL_INTERVAL_MS = 2000;

type TranscribeRequest = {
  /** AMR-WB, 16 kHz mono, base64-encoded */
  audio: string;
  durationMs: number | null;
  languageCode: string;
};

type RecognizeResponse = {
  results?: { alternatives?: { transcript?: string }[] }[];
};

type Operation = {
  name: string;
  done?: boolean;
  response?: RecognizeResponse;
  error?: { message?: string };
};

async function callGoogle<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.GOOGLE_SPEECH_API_KEY ?? '';
  const response = await fetch(`${GOOGLE_API_URL}/${path}?key=${encodeURIComponent(key)}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Google Cloud Speech returned HTTP ${response.status}`);
  }
  return body as T;
}

function joinResults(response: RecognizeResponse | undefined) {
  return (response?.results ?? [])
    .map((result) => result.alternatives?.[0]?.transcript?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

async function transcribe({ audio, durationMs, languageCode }: TranscribeRequest) {
  const request = JSON.stringify({
    config: {
      encoding: 'AMR_WB',
      sampleRateHertz: 16000,
      languageCode,
      enableAutomaticPunctuation: true,
    },
    audio: { content: audio },
  });

  if (durationMs !== null && durationMs <= SYNC_LIMIT_MS) {
    return joinResults(await callGoogle<RecognizeResponse>('speech:recognize', { method: 'POST', body: request }));
  }

  let operation = await callGoogle<Operation>('speech:longrunningrecognize', { method: 'POST', body: request });
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    operation = await callGoogle<Operation>(`operations/${operation.name}`);
  }
  if (operation.error) throw new Error(operation.error.message ?? 'Transcription failed');
  return joinResults(operation.response);
}

export async function POST(request: Request) {
  // A shared token keeps strangers from spending the Google Cloud credit
  const token = process.env.SPEECH_API_TOKEN;
  const missing = [
    !token && 'SPEECH_API_TOKEN',
    !process.env.GOOGLE_SPEECH_API_KEY && 'GOOGLE_SPEECH_API_KEY',
  ].filter(Boolean);
  if (missing.length > 0) {
    return Response.json({ error: `The server is missing ${missing.join(' and ')}` }, { status: 500 });
  }
  if (request.headers.get('Authorization') !== `Bearer ${token}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: TranscribeRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Expected a JSON body' }, { status: 400 });
  }
  if (typeof body.audio !== 'string' || !body.audio || typeof body.languageCode !== 'string') {
    return Response.json({ error: 'Missing audio or languageCode' }, { status: 400 });
  }

  try {
    return Response.json({ text: await transcribe(body) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
