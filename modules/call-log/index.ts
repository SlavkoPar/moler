import { PermissionsAndroid } from 'react-native';

import CallLogModule from './src/CallLogModule';
import type { LastCall } from './src/CallLog.types';

export * from './src/CallLog.types';

/** True only in an Android build that includes this module (not Expo Go, iOS or web) */
export const isCallLogAvailable = CallLogModule != null;

export class CallLogPermissionDeniedError extends Error {
  constructor() {
    super('Permission to read the call log was denied');
    this.name = 'CallLogPermissionDeniedError';
  }
}

/** Asks for call log access if needed, then returns the most recent call (null if the log is empty) */
export async function getLastCallAsync(): Promise<LastCall | null> {
  if (!CallLogModule) {
    throw new Error('Reading the call log is only available in the Android app build');
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG, {
    title: 'Read call log',
    message: 'Allow access to the call log to fill in the number of your last call.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new CallLogPermissionDeniedError();
  }
  return CallLogModule.getLastCallAsync();
}
