/** Browsers can't share local files, so the XML is downloaded instead */
export async function shareXmlFile(fileName: string, xml: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser a moment to start the download before releasing the file
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
