import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class FileShareModule extends NativeModule<{}> {
  shareFileAsync(fileUrl: string, mimeType: string, title: string): Promise<void>;
}

// Null where the native code isn't built in: Expo Go, iOS, web
export default requireOptionalNativeModule<FileShareModule>('FileShare');
