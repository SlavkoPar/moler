import FileShareModule from './src/FileShareModule';

/** True only in an Android build that includes this module */
export const isFileShareAvailable = FileShareModule != null;

/** Opens the Android share sheet for a local file:// URL and lets every receiving app read it */
export async function shareFileAsync(fileUrl: string, mimeType: string, title: string) {
  if (!FileShareModule) throw new Error('File sharing is only available in the Android app build');
  await FileShareModule.shareFileAsync(fileUrl, mimeType, title);
}
