import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/db/calls';
import { showAlert } from '@/lib/alert';
import { CLOUD_RECORDING_OPTIONS, transcribeRecording } from '@/lib/cloud-speech';
import { getSpeechSupport, SPEECH_LANGUAGE, speechModule } from '@/lib/speech';
import { canPlay } from '@/lib/voice-file';

/** A finished recording that hasn't been saved to the database yet */
export type RecordedVoice = {
  uri: string;
  durationMs: number | null;
};

type Props = {
  value: RecordedVoice | null;
  onChange: (value: RecordedVoice | null) => void;
  /** Current transcript; new speech is appended to it */
  transcript: string;
  onTranscriptChange: (text: string) => void;
};

/** What the speech recognizer is currently doing: transcribing a recording, or dictating text only */
type SpeechSession = 'record' | 'dictate' | null;

export function formatVoiceDuration(durationMs: number | null) {
  return durationMs === null ? '' : formatDuration(Math.round(durationMs / 1000));
}

function joinText(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

export function VoiceRecorderField({ value, onChange, transcript, onTranscriptChange }: Props) {
  const [support] = useState(getSpeechSupport);
  const { mode } = support;
  const recorder = useAudioRecorder(
    mode === 'cloud' ? CLOUD_RECORDING_OPTIONS : RecordingPresets.HIGH_QUALITY
  );
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  // "recognizing" is used in "recognizer" mode, where the speech recognizer does the recording
  const [recognizing, setRecognizing] = useState(false);
  const [dictating, setDictating] = useState(false);
  // Used in "cloud" mode while Google Cloud Speech transcribes the finished recording
  const [transcribing, setTranscribing] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Speech events arrive through listeners registered once, so they read the latest values from refs
  const sessionRef = useRef<SpeechSession>(null);
  const keepDictatingRef = useRef(false);
  const textBeforeRef = useRef('');
  const finalTextRef = useRef('');
  const startedAtRef = useRef(0);
  const callbacksRef = useRef({ onChange, onTranscriptChange, transcript });
  useEffect(() => {
    callbacksRef.current = { onChange, onTranscriptChange, transcript };
  });

  useEffect(() => {
    if (!speechModule || !support.canDictate) return;
    const module = speechModule;
    const subscriptions = [
      module.addListener('result', (event) => {
        const text = event.results[0]?.transcript ?? '';
        const before = textBeforeRef.current;
        if (Platform.OS === 'ios') {
          // iOS reports the whole transcript of the session each time
          callbacksRef.current.onTranscriptChange(joinText(before, text));
        } else if (event.isFinal) {
          // Android and browsers finish each phrase separately, then start a new one
          finalTextRef.current = joinText(finalTextRef.current, text);
          callbacksRef.current.onTranscriptChange(joinText(before, finalTextRef.current));
        } else {
          callbacksRef.current.onTranscriptChange(joinText(before, finalTextRef.current, text));
        }
      }),
      module.addListener('audioend', (event) => {
        // In "recognizer" mode the recognizer's own recording becomes the voice message
        if (sessionRef.current === 'record' && mode === 'recognizer' && event.uri) {
          callbacksRef.current.onChange({
            uri: event.uri,
            durationMs: Date.now() - startedAtRef.current,
          });
        }
      }),
      module.addListener('error', (event) => {
        // Silence and cancelling are expected, not errors worth showing
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        keepDictatingRef.current = false;
        setSpeechError(event.message || event.error);
      }),
      module.addListener('end', () => {
        // Without continuous recognition (Android 12 and older) dictation stops after each
        // phrase, so it is restarted until the user taps Stop
        if (sessionRef.current === 'dictate' && keepDictatingRef.current) {
          module.start({
            lang: SPEECH_LANGUAGE,
            interimResults: true,
            addsPunctuation: true,
            requiresOnDeviceRecognition: support.onDevice,
          });
          return;
        }
        sessionRef.current = null;
        setRecognizing(false);
        setDictating(false);
      }),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      keepDictatingRef.current = false;
      module.abort();
    };
  }, [mode, support.canDictate, support.onDevice]);

  // Tick the timer while the recognizer records
  useEffect(() => {
    if (!recognizing) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [recognizing]);

  // Load each new recording into the player so it can be listened to before saving
  useEffect(() => {
    if (value) {
      player.replace({ uri: value.uri });
    } else {
      player.pause();
    }
  }, [player, value]);

  const startRecognition = (session: Exclude<SpeechSession, null>) => {
    if (!speechModule) return;
    sessionRef.current = session;
    textBeforeRef.current = transcript;
    finalTextRef.current = '';
    setSpeechError(null);
    speechModule.start({
      lang: SPEECH_LANGUAGE,
      interimResults: true,
      continuous: support.supportsContinuous,
      addsPunctuation: true,
      requiresOnDeviceRecognition: support.onDevice,
      recordingOptions: { persist: session === 'record' && mode === 'recognizer' },
    });
  };

  const requestSpeechPermissions = async () => {
    const { granted } = (await speechModule?.requestPermissionsAsync()) ?? { granted: false };
    if (!granted) {
      showAlert(
        'Permission needed',
        'Allow microphone and speech recognition access to turn speech into text.'
      );
    }
    return granted;
  };

  const handleRecord = async () => {
    player.pause();
    setRecordingError(null);

    if (mode === 'recognizer') {
      if (!(await requestSpeechPermissions())) return;
      startRecognition('record');
      const time = Date.now();
      startedAtRef.current = time;
      setStartedAt(time);
      setNow(time);
      setRecognizing(true);
      return;
    }

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      showAlert('Microphone access needed', 'Allow microphone access to record a voice message.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    if (mode === 'parallel') {
      try {
        startRecognition('record');
      } catch (error) {
        // The recording still works without a transcript
        setSpeechError(String(error));
      }
    }
  };

  const handleStop = async () => {
    if (mode === 'recognizer') {
      // The file arrives in the "audioend" event once the recognizer has finished
      speechModule?.stop();
      return;
    }
    const durationMs = recorderState.durationMillis;
    if (mode === 'parallel') speechModule?.stop();
    await recorder.stop();
    // Leaving recording mode sends playback back to the loudspeaker on iOS
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const uri = recorder.uri;
    if (!uri || !(await canPlay(uri))) {
      setRecordingError(
        'The recording came out empty. Make sure no other app or browser tab is using the microphone, then record again.'
      );
      return;
    }
    const recording = { uri, durationMs: durationMs || null };
    onChange(recording);
    if (mode === 'cloud') await transcribeInCloud(recording);
  };

  const transcribeInCloud = async (recording: RecordedVoice) => {
    setSpeechError(null);
    setTranscribing(true);
    try {
      const text = await transcribeRecording(recording.uri, recording.durationMs, SPEECH_LANGUAGE);
      if (text) {
        const { onTranscriptChange, transcript } = callbacksRef.current;
        onTranscriptChange(joinText(transcript, text));
      } else {
        setSpeechError('no speech was recognized in the recording.');
      }
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : String(error));
    } finally {
      setTranscribing(false);
    }
  };

  const handleDictate = async () => {
    if (dictating) {
      keepDictatingRef.current = false;
      speechModule?.stop();
      return;
    }
    if (!(await requestSpeechPermissions())) return;
    player.pause();
    keepDictatingRef.current = true;
    startRecognition('dictate');
    setDictating(true);
  };

  const handleTogglePlay = async () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    const finished =
      playerStatus.didJustFinish ||
      (playerStatus.duration > 0 && playerStatus.currentTime >= playerStatus.duration);
    if (finished) await player.seekTo(0);
    player.play();
  };

  const isRecording = mode === 'recognizer' ? recognizing : recorderState.isRecording;
  const elapsedMs = mode === 'recognizer' ? Math.max(0, now - startedAt) : recorderState.durationMillis;

  const notes = (
    <>
      {transcribing && (
        <ThemedText type="small" themeColor="textSecondary">
          Transcribing on the server…
        </ThemedText>
      )}
      {recordingError && (
        <ThemedText type="small" style={styles.recording}>
          {recordingError}
        </ThemedText>
      )}
      {speechError && (
        <ThemedText type="small" themeColor="textSecondary">
          Transcription unavailable: {speechError}
        </ThemedText>
      )}
    </>
  );

  if (isRecording) {
    return (
      <ThemedView style={styles.field}>
        <ThemedView style={styles.row}>
          <Pressable onPress={handleStop} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.button}>
              <ThemedText type="smallBold">■ Stop</ThemedText>
            </ThemedView>
          </Pressable>
          <ThemedText type="small" style={styles.recording}>
            ● Recording {formatVoiceDuration(elapsedMs)}
          </ThemedText>
        </ThemedView>
        {notes}
      </ThemedView>
    );
  }

  if (dictating) {
    return (
      <ThemedView style={styles.field}>
        <ThemedView style={styles.row}>
          <Pressable onPress={handleDictate} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.button}>
              <ThemedText type="smallBold">■ Stop dictating</ThemedText>
            </ThemedView>
          </Pressable>
          <ThemedText type="small" style={styles.recording}>
            ● Listening… speak, the text appears in Transcript
          </ThemedText>
        </ThemedView>
        {notes}
      </ThemedView>
    );
  }

  const transcribeButton = mode === 'cloud' && value && !transcribing && (
    <Pressable onPress={() => transcribeInCloud(value)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.button}>
        <ThemedText type="smallBold">Transcribe</ThemedText>
      </ThemedView>
    </Pressable>
  );

  const dictateButton = support.canDictate && (
    <Pressable onPress={handleDictate} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.button}>
        <ThemedText type="smallBold">🎤 Dictate</ThemedText>
      </ThemedView>
    </Pressable>
  );

  return (
    <ThemedView style={styles.field}>
      <ThemedView style={styles.row}>
        {value ? (
          <>
            <Pressable onPress={handleTogglePlay} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.button}>
                <ThemedText type="smallBold">
                  {playerStatus.playing ? '❚❚ Pause' : '▶ Play'}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              Voice message {formatVoiceDuration(value.durationMs)}
            </ThemedText>
            <Pressable onPress={() => onChange(null)} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="smallBold">Delete</ThemedText>
              </ThemedView>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={handleRecord}
            style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="smallBold">● Record voice message</ThemedText>
            </ThemedView>
          </Pressable>
        )}
        {transcribeButton}
        {dictateButton}
      </ThemedView>
      {support.reason && (
        <ThemedText type="small" themeColor="textSecondary">
          {support.reason}
        </ThemedText>
      )}
      {notes}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  recording: {
    color: '#E5484D',
  },
  pressed: {
    opacity: 0.7,
  },
});
