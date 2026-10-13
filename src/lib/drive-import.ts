import type { ExportFile } from '@/db/imports';
import { callServer } from '@/lib/moler-server';

/**
 * Takes the folder id from a pasted Drive link: ".../drive/folders/<id>?usp=sharing",
 * ".../drive/u/0/folders/<id>", "...open?id=<id>", or the bare id
 */
export function parseDriveFolderId(link: string): string | null {
  const trimmed = link.trim();
  const match =
    trimmed.match(/\/folders\/([\w-]{10,})/) ??
    trimmed.match(/[?&]id=([\w-]{10,})/) ??
    trimmed.match(/^([\w-]{10,})$/);
  return match ? match[1] : null;
}

/** The e-mail the Drive folder has to be shared with (the server's service account) */
export async function getDriveServiceAccountEmail(): Promise<string> {
  const { serviceAccountEmail } = await callServer<{ serviceAccountEmail: string }>('/api/drive-files', {
    method: 'GET',
  });
  return serviceAccountEmail;
}

/** Downloads every moler-calls*.xml file from the Drive folder through the moler server */
export async function fetchDriveExportFiles(folderId: string): Promise<{ folderName: string; files: ExportFile[] }> {
  return callServer('/api/drive-files', { method: 'POST', body: { folderId } });
}
