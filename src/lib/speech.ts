import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type * as SpeechRecognition from 'expo-speech-recognition';

import { isCloudSpeechConfigured } from '@/lib/cloud-speech';

import { isCallLogAvailable } from '../../modules/call-log';

/** Language the voice messages are recognized in */
export const SPEECH_LANGUAGE = 'sr-RS';

// Importing expo-speech-recognition throws on builds without its native code (e.g. Expo Go),
// so it is only loaded where it can work
const isInstalled =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeechRecognition') != null;

export const speechModule: typeof SpeechRecognition.ExpoSpeechRecognitionModule | null = isInstalled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-speech-recognition').ExpoSpeechRecognitionModule
  : null;

/**
 * How a voice message is recorded and transcribed on this device:
 * - "recognizer": the speech recognizer records the audio file itself (Android 13+, iOS),
 *   because it can't share the microphone with expo-audio
 * - "parallel": expo-audio records while the browser recognizes speech at the same time (web)
 * - "cloud": expo-audio records, then the moler server transcribes the file with Google Cloud Speech
 *   (phones without any speech service, e.g. Huawei without Google services)
 * - "audio-only": the recording can't be transcribed while it is made
 */
export type TranscriptionMode = 'recognizer' | 'parallel' | 'cloud' | 'audio-only';

export type SpeechSupport = {
  mode: TranscriptionMode;
  /** Speech can be turned into text without recording audio ("Dictate") */
  canDictate: boolean;
  /** Recognition keeps listening through pauses; otherwise it has to be restarted after each phrase */
  supportsContinuous: boolean;
  /** Use the phone's on-device recognizer, because no regular speech service is installed */
  onDevice: boolean;
  /** Why transcription while recording isn't available, and what to do about it */
  reason: string | null;
};

/** Android API level, or 0 on other platforms */
const androidApiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0;

/** Lists the speech services Android sees, so a missing service can be diagnosed on the phone */
function describeAndroidServices(module: NonNullable<typeof speechModule>) {
  const services = module.getSpeechRecognitionServices();
  const defaultService = module.getDefaultRecognitionService().packageName;
  return `Android API ${androidApiLevel}; services: ${services.join(', ') || 'none'}; default voice input: ${defaultService || 'none'}.`;
}

export function getSpeechSupport(): SpeechSupport {
  if (!speechModule) {
    // The call-log module ships in the same moler build, so if it's missing too this is Expo Go
    const inExpoGo = Platform.OS === 'android' && !isCallLogAvailable;
    return {
      mode: 'audio-only',
      canDictate: false,
      supportsContinuous: false,
      onDevice: false,
      reason: inExpoGo
        ? "You're in Expo Go, which can't include speech-to-text. Open the moler app instead (install it from your EAS development build link)."
        : "Speech-to-text isn't part of this app build. Rebuild the app (npx expo run:android or an EAS development build).",
    };
  }
  if (!speechModule.isRecognitionAvailable()) {
    // The moler server handles Serbian reliably, so it is preferred over an on-device model
    if (Platform.OS !== 'web' && isCloudSpeechConfigured) {
      return { mode: 'cloud', canDictate: false, supportsContinuous: false, onDevice: false, reason: null };
    }
    // Phones with only "Speech Recognition & Synthesis" (no Google app) offer just an on-device
    // recognizer, which Android 13+ can use directly
    if (androidApiLevel >= 33 && speechModule.supportsOnDeviceRecognition()) {
      return { mode: 'recognizer', canDictate: true, supportsContinuous: true, onDevice: true, reason: null };
    }
    return {
      mode: 'audio-only',
      canDictate: false,
      supportsContinuous: false,
      onDevice: false,
      reason:
        Platform.OS === 'web'
          ? "This browser doesn't support speech recognition. Use Edge or Chrome."
          : `No speech recognition service found. Install or update the Google app and set it as voice input. (${describeAndroidServices(speechModule)})`,
    };
  }
  if (Platform.OS === 'web') {
    return { mode: 'parallel', canDictate: true, supportsContinuous: true, onDevice: false, reason: null };
  }
  if (speechModule.supportsRecording()) {
    return { mode: 'recognizer', canDictate: true, supportsContinuous: true, onDevice: false, reason: null };
  }
  // Android 12 and older: recognition works, but can't save the audio at the same time
  return {
    mode: 'audio-only',
    canDictate: true,
    supportsContinuous: false,
    onDevice: false,
    reason:
      "On Android 12 and older speech can't be converted while recording. Record the message, then tap Dictate and repeat it to fill the transcript.",
  };
}
