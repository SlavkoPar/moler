import { EXPORT_FILE_PREFIX, type ExportFile } from '@/db/imports';

export type PickedExportFiles = {
  folderUri: string;
  folderName: string;
  files: ExportFile[];
};

/** Browsers let the user pick a folder through a file input; null when nothing was chosen */
export function pickExportFiles(): Promise<PickedExportFiles | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.addEventListener('change', async () => {
      try {
        const picked = Array.from(input.files ?? []);
        if (picked.length === 0) {
          resolve(null);
          return;
        }
        const exportFiles = picked.filter(
          (file) => file.name.startsWith(EXPORT_FILE_PREFIX) && file.name.toLowerCase().endsWith('.xml')
        );
        const folderName = picked[0].webkitRelativePath.split('/')[0] || 'folder';
        resolve({
          folderUri: '',
          folderName,
          files: await Promise.all(exportFiles.map(async (file) => ({ name: file.name, text: await file.text() }))),
        });
      } catch (error) {
        reject(error);
      }
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function readExportFolder(): Promise<PickedExportFiles> {
  return Promise.reject(new Error('Browsers cannot reopen a folder; choose it again'));
}

/** Browsers don't keep access to a picked folder */
export const canRememberFolder = false;
