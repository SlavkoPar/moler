import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { isFileShareAvailable, shareFileAsync } from '../../modules/file-share';

/** Plain file names only (letters, digits, "." and "-"), also for names saved by older versions */
function safeFileName(fileName: string) {
  return fileName
    .replace(/@/g, '-at-')
    .replace(/[^A-Za-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-');
}

/** Writes the XML to a cache file and opens the share sheet (save to Files, Drive, e-mail, ...) */
export async function shareXmlFile(fileName: string, xml: string) {
  const file = new File(Paths.cache, safeFileName(fileName));
  if (file.exists) file.delete();
  file.create();
  file.write(xml);
  // Our own share sheet shares a copy in Download/moler and grants every receiving app access,
  // which Google Drive on Huawei phones (inside GBox) needs
  if (isFileShareAvailable) {
    await shareFileAsync(file.uri, 'application/xml', file.name);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files is not available on this device');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/xml', dialogTitle: file.name });
}
