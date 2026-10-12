import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Google Drive failed to upload shared files whose name contained "@", so names saved by older
 * versions (e.g. with an e-mail address) are made safe here too
 */
function safeFileName(fileName: string) {
  return fileName.replace(/@/g, '_at_').replace(/[^A-Za-z0-9._-]+/g, '-');
}

/** Writes the XML to a cache file and opens the share sheet (save to Files, Drive, e-mail, ...) */
export async function shareXmlFile(fileName: string, xml: string) {
  const file = new File(Paths.cache, safeFileName(fileName));
  if (file.exists) file.delete();
  file.create();
  file.write(xml);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files is not available on this device');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/xml', dialogTitle: fileName });
}
