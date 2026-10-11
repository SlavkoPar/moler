import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the XML to a cache file and opens the share sheet (save to Files, Drive, e-mail, ...) */
export async function shareXmlFile(fileName: string, xml: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(xml);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files is not available on this device');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/xml', dialogTitle: fileName });
}
