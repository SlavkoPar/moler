/**
 * Reads moler export files from a Google Drive folder for the Imports tab.
 *
 * The server signs in to Google as a service account (GOOGLE_SERVICE_ACCOUNT_JSON, the JSON key as
 * text or base64). The user shares the Drive folder with that account's e-mail as Viewer, so the
 * folder stays private. Phones can't do this themselves: Drive offers no folder access through
 * Android's file picker, and on Huawei phones Drive (inside GBox) isn't in the picker at all.
 *
 * GET  → { serviceAccountEmail } to show which address the folder must be shared with
 * POST { folderId } → { folderName, files: [{ name, text }] } for every moler-calls*.xml file
 */

const EXPORT_FILE_PREFIX = 'moler-calls';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

type ServiceAccount = { client_email: string; private_key: string };

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function readServiceAccount(): ServiceAccount {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '').trim();
  if (!raw) throw new HttpError(500, 'The server is missing GOOGLE_SERVICE_ACCOUNT_JSON');
  // Stored as base64 so the multi-line JSON survives the command line
  const text = raw.startsWith('{') ? raw : atob(raw);
  const account = JSON.parse(text) as Partial<ServiceAccount>;
  if (!account.client_email || !account.private_key) {
    throw new HttpError(500, 'GOOGLE_SERVICE_ACCOUNT_JSON is not a service account key');
  }
  return account as ServiceAccount;
}

function base64Url(data: ArrayBuffer | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Exchanges a JWT signed with the service account's key for a short-lived access token */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify({ iss: account.client_email, scope: DRIVE_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  )}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
  });
  const body = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !body.access_token) {
    throw new HttpError(502, `Google sign-in failed: ${body.error_description ?? body.error ?? response.status}`);
  }
  return body.access_token;
}

async function driveGet(path: string, token: string) {
  const response = await fetch(`${DRIVE_API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw Object.assign(new HttpError(502, body.error?.message ?? `Google Drive returned HTTP ${response.status}`), {
      driveStatus: response.status,
    });
  }
  return response;
}

async function readFolder(folderId: string, account: ServiceAccount) {
  const token = await getAccessToken(account);

  let folder: { name: string; mimeType: string };
  try {
    folder = await (
      await driveGet(`files/${encodeURIComponent(folderId)}?fields=name,mimeType&supportsAllDrives=true`, token)
    ).json();
  } catch (error) {
    if ((error as { driveStatus?: number }).driveStatus === 404) {
      throw new HttpError(
        404,
        `The folder wasn't found. Check the link and share the folder with ${account.client_email} (Viewer).`
      );
    }
    throw error;
  }
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new HttpError(400, `"${folder.name}" is a file, not a folder. Paste the link of the folder.`);
  }

  const files: { id: string; name: string }[] = [];
  let pageToken = '';
  do {
    const query = `'${folderId.replace(/'/g, "\\'")}' in parents and name contains '${EXPORT_FILE_PREFIX}' and trashed = false`;
    const page = (await (
      await driveGet(
        `files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name)&pageSize=1000` +
          `&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ''}`,
        token
      )
    ).json()) as { files: { id: string; name: string }[]; nextPageToken?: string };
    files.push(...page.files);
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);

  // "contains" in Drive queries matches words anywhere, so check the prefix and extension here
  const exportFiles = files.filter(
    (file) => file.name.startsWith(EXPORT_FILE_PREFIX) && file.name.toLowerCase().endsWith('.xml')
  );
  return {
    folderName: folder.name,
    files: await Promise.all(
      exportFiles.map(async (file) => ({
        name: file.name,
        text: await (await driveGet(`files/${file.id}?alt=media&supportsAllDrives=true`, token)).text(),
      }))
    ),
  };
}

function authorize(request: Request) {
  const token = process.env.SPEECH_API_TOKEN;
  if (!token) throw new HttpError(500, 'The server is missing SPEECH_API_TOKEN');
  if (request.headers.get('Authorization') !== `Bearer ${token}`) throw new HttpError(401, 'Unauthorized');
}

async function handle(request: Request, run: () => Promise<unknown>) {
  try {
    authorize(request);
    return json(await run());
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function GET(request: Request) {
  return handle(request, async () => ({ serviceAccountEmail: readServiceAccount().client_email }));
}

export function POST(request: Request) {
  return handle(request, async () => {
    const { folderId } = (await request.json().catch(() => ({}))) as { folderId?: unknown };
    if (typeof folderId !== 'string' || !/^[\w-]{10,}$/.test(folderId)) {
      throw new HttpError(400, 'Missing or invalid Google Drive folder id');
    }
    return readFolder(folderId, readServiceAccount());
  });
}
