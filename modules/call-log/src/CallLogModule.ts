import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { LastCall } from './CallLog.types';

declare class CallLogModule extends NativeModule<{}> {
  getLastCallAsync(): Promise<LastCall | null>;
}

// Null where the native code isn't built in: Expo Go, iOS
export default requireOptionalNativeModule<CallLogModule>('CallLog');
