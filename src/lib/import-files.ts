import { Directory, File } from 'expo-file-system';

import { EXPORT_FILE_PREFIX, type ExportFile } from '@/db/imports';

export type PickedExportFiles = {
  /** The folder the files came from, so it can be imported again without picking */
  folderUri: string;
  folderName: string;
  files: ExportFile[];
};

function isCancel(error: unknown) {
  return error instanceof Error && /cancel/i.test(error.message);
}

/** Reads every moler-calls*.xml file directly in the folder */
async function readExportFiles(directory: Directory): Promise<ExportFile[]> {
  const exportFiles = directory
    .list()
    .filter(
      (entry): entry is File =>
        entry instanceof File &&
        entry.name.startsWith(EXPORT_FILE_PREFIX) &&
        entry.name.toLowerCase().endsWith('.xml')
    );
  return Promise.all(exportFiles.map(async (file) => ({ name: file.name, text: await file.text() })));
}

/** Lets the user choose a folder (Download/moler, a Drive folder, ...); null when they cancel */
export async function pickExportFiles(initialUri?: string): Promise<PickedExportFiles | null> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync(initialUri);
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
  return { folderUri: directory.uri, folderName: directory.name, files: await readExportFiles(directory) };
}

/** Reads the folder chosen earlier again; the app keeps access to it after the first pick */
export async function readExportFolder(folderUri: string): Promise<PickedExportFiles> {
  const directory = new Directory(folderUri);
  return { folderUri, folderName: directory.name, files: await readExportFiles(directory) };
}

export const canRememberFolder = true;
