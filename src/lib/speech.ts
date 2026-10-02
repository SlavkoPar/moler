import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type * as SpeechRecognition from 'expo-speech-recognition';

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
 * - "audio-only": the recording can't be transcribed while it is made
 */
export type TranscriptionMode = 'recognizer' | 'parallel' | 'audio-only';

export type SpeechSupport = {
  mode: TranscriptionMode;
  /** Speech can be turned into text without recording audio ("Dictate") */
  canDictate: boolean;
  /** Recognition keeps listening through pauses; otherwise it has to be restarted after each phrase */
  supportsContinuous: boolean;
  /** Why transcription while recording isn't available, and what to do about it */
  reason: string | null;
};

export function getSpeechSupport(): SpeechSupport {
  if (!speechModule) {
    // The call-log module ships in the same moler build, so if it's missing too this is Expo Go
    const inExpoGo = Platform.OS === 'android' && !isCallLogAvailable;
    return {
      mode: 'audio-only',
      canDictate: false,
      supportsContinuous: false,
      reason: inExpoGo
        ? "You're in Expo Go, which can't include speech-to-text. Open the moler app instead (install it from your EAS development build link)."
        : "Speech-to-text isn't part of this app build. Rebuild the app (npx expo run:android or an EAS development build).",
    };
  }
  if (!speechModule.isRecognitionAvailable()) {
    return {
      mode: 'audio-only',
      canDictate: false,
      supportsContinuous: false,
      reason:
        Platform.OS === 'web'
          ? "This browser doesn't support speech recognition. Use Edge or Chrome."
          : 'No speech recognition service found. Install or update the Google app and allow it as voice input.',
    };
  }
  if (Platform.OS === 'web') {
    return { mode: 'parallel', canDictate: true, supportsContinuous: true, reason: null };
  }
  if (speechModule.supportsRecording()) {
    return { mode: 'recognizer', canDictate: true, supportsContinuous: true, reason: null };
  }
  // Android 12 and older: recognition works, but can't save the audio at the same time
  return {
    mode: 'audio-only',
    canDictate: true,
    supportsContinuous: false,
    reason:
      "On Android 12 and older speech can't be converted while recording. Record the message, then tap Dictate and repeat it to fill the transcript.",
  };
}
