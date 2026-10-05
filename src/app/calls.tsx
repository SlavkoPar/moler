import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import {
  formatVoiceDuration,
  VoiceRecorderField,
  type RecordedVoice,
} from '@/components/voice-recorder-field';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addCall,
  deleteCall,
  displayName,
  findPersonByPhone,
  formatCents,
  formatDuration,
  getCalls,
  getPeopleSummary,
  getVoiceMessage,
  parseDuration,
  parsePriceToCents,
  type PersonSummary,
  type PhoneCall,
} from '@/db/calls';
import { useTheme } from '@/hooks/use-theme';
import { confirmDestructive, showAlert } from '@/lib/alert';
import { canPlay, readRecording, toPlayableUri } from '@/lib/voice-file';

import {
  CALL_TYPES,
  CallLogPermissionDeniedError,
  getLastCallAsync,
  isCallLogAvailable,
  type CallType,
} from '../../modules/call-log';

type ListView = 'calls' | 'people';

type ListRow = { kind: 'call'; call: PhoneCall } | { kind: 'person'; person: PersonSummary };

function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short summary of the call log details, e.g. "Incoming · Mobile · 5:30 · Belgrade" */
function callDetails(call: PhoneCall) {
  return [
    call.callType ? capitalize(call.callType) : '',
    call.isVideo ? 'Video' : '',
    call.numberLabel,
    call.durationSeconds !== null ? formatDuration(call.durationSeconds) : '',
    call.location,
    call.countryIso,
  ]
    .filter(Boolean)
    .join(' · ');
}

async function loadData(db: ReturnType<typeof useSQLiteContext>) {
  const [calls, people] = await Promise.all([getCalls(db), getPeopleSummary(db)]);
  return { calls, people };
}

export default function CallsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const listRef = useRef<FlatList<ListRow>>(null);

  const [calls, setCalls] = useState<PhoneCall[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [view, setView] = useState<ListView>('calls');
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [calledAt, setCalledAt] = useState(() => new Date());
  const [comment, setComment] = useState('');
  const [price, setPrice] = useState('');
  const [voice, setVoice] = useState<RecordedVoice | null>(null);
  const [transcript, setTranscript] = useState('');

  // One shared player for voice messages in the list, so only one plays at a time
  const listPlayer = useAudioPlayer(null);
  const listPlayerStatus = useAudioPlayerStatus(listPlayer);
  const [playingCallId, setPlayingCallId] = useState<number | null>(null);
  // "More..." details, usually filled from the phone's call log
  const [callType, setCallType] = useState<CallType | null>(null);
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [numberLabel, setNumberLabel] = useState('');
  const [countryIso, setCountryIso] = useState('');
  const [isVideo, setIsVideo] = useState(false);

  const resetDetails = () => {
    setCallType(null);
    setDuration('');
    setLocation('');
    setNumberLabel('');
    setCountryIso('');
    setIsVideo(false);
  };

  // Prefill from a deep link like moler://calls?caller=+381601234567 (e.g. sent by MacroDroid after a call)
  const { caller: callerParam } = useLocalSearchParams<{ caller?: string }>();
  const [prevCallerParam, setPrevCallerParam] = useState<string | undefined>();
  if (callerParam !== prevCallerParam) {
    setPrevCallerParam(callerParam);
    if (callerParam) {
      // A raw "+" in a query string may be decoded as a space, so restore it for international numbers
      const trimmed = callerParam.trim();
      setPhone(/^ \d/.test(callerParam) ? `+${trimmed}` : trimmed);
      setCalledAt(new Date());
    }
  }

  // When the number belongs to someone saved before, fill in their name and address
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      findPersonByPhone(db, phone).then((person) => {
        if (cancelled || !person) return;
        setName((current) => current || person.name);
        setAddress((current) => current || person.address);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [db, phone]);

  const reload = useCallback(async () => {
    const data = await loadData(db);
    setCalls(data.calls);
    setPeople(data.people);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    loadData(db).then((data) => {
      if (cancelled) return;
      setCalls(data.calls);
      setPeople(data.people);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const pickDateTimeAndroid = () => {
    DateTimePickerAndroid.open({
      value: calledAt,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onChange: (timeEvent, dateTime) => {
            if (timeEvent.type === 'set' && dateTime) setCalledAt(dateTime);
          },
        });
      },
    });
  };

  const handlePastePhone = async () => {
    // On iOS the system asks for paste permission; a denial also yields an empty string
    const text = (await Clipboard.getStringAsync()).trim().replace(/\s+/g, ' ');
    if (!text) {
      showAlert('Clipboard is empty', 'Copy the number from your recent calls first.');
      return;
    }
    setPhone(text);
  };

  const handleUseLastCall = async () => {
    try {
      const lastCall = await getLastCallAsync();
      if (!lastCall) {
        showAlert('No calls', 'The call log is empty.');
        return;
      }
      if (!lastCall.number) {
        showAlert('Hidden number', 'The last call came from a private or hidden number.');
        return;
      }
      setPhone(lastCall.number);
      const cachedName = lastCall.name;
      if (cachedName) setName((current) => current || cachedName);
      setCalledAt(new Date(lastCall.date));
      setCallType(lastCall.type);
      setDuration(formatDuration(lastCall.durationSeconds));
      setLocation(lastCall.geocodedLocation ?? '');
      setNumberLabel(lastCall.numberLabel ?? '');
      setCountryIso(lastCall.countryIso ?? '');
      setIsVideo(lastCall.isVideo);
    } catch (error) {
      if (error instanceof CallLogPermissionDeniedError) {
        showAlert(
          'Permission needed',
          'Allow call log access in the app settings to fill in the last call.'
        );
      } else {
        showAlert('Could not read call log', String(error));
      }
    }
  };

  const handleSave = async () => {
    if (!phone.trim() && !name.trim()) {
      showAlert('Missing caller', 'Enter a phone number or a name.');
      return;
    }
    const priceCents = parsePriceToCents(price);
    if (Number.isNaN(priceCents)) {
      showAlert('Invalid price', 'Enter a number like 12.50');
      return;
    }
    const durationSeconds = parseDuration(duration);
    if (Number.isNaN(durationSeconds)) {
      showAlert('Invalid duration', 'Enter minutes:seconds like 5:30, or seconds like 330');
      return;
    }
    let voiceMessage = null;
    if (voice) {
      try {
        voiceMessage = { ...(await readRecording(voice.uri)), durationMs: voice.durationMs };
        if (voiceMessage.data.length === 0) throw new Error('The recording is empty');
      } catch (error) {
        showAlert('Could not read the voice message', String(error));
        return;
      }
    }

    await addCall(db, {
      phone,
      name,
      address,
      calledAt: calledAt.toISOString(),
      comment: comment.trim(),
      priceCents,
      callType,
      durationSeconds,
      location,
      numberLabel,
      countryIso,
      isVideo,
      voice: voiceMessage,
      transcript,
    });

    setPhone('');
    setName('');
    setAddress('');
    setComment('');
    setPrice('');
    setCalledAt(new Date());
    resetDetails();
    setVoice(null);
    setTranscript('');
    // Clear the deep link param so the next link with the same number prefills again
    router.setParams({ caller: undefined });
    await reload();
  };

  const handleDelete = (call: PhoneCall) => {
    confirmDestructive('Delete call', `Delete call from ${displayName(call)}?`, 'Delete', async () => {
      await deleteCall(db, call.id);
      await reload();
    });
  };

  const handlePlayVoice = async (call: PhoneCall) => {
    if (playingCallId === call.id) {
      if (listPlayerStatus.playing) {
        listPlayer.pause();
        return;
      }
      const finished =
        listPlayerStatus.didJustFinish ||
        (listPlayerStatus.duration > 0 && listPlayerStatus.currentTime >= listPlayerStatus.duration);
      if (finished) await listPlayer.seekTo(0);
      listPlayer.play();
      return;
    }
    const voiceMessage = await getVoiceMessage(db, call.id);
    if (!voiceMessage) return;
    const uri = toPlayableUri(voiceMessage, call.id);
    if (voiceMessage.data.length === 0 || !(await canPlay(uri))) {
      showAlert(
        "Can't play voice message",
        'This recording is empty or in a format this browser cannot play. It may have been recorded while the microphone was in use elsewhere.'
      );
      return;
    }
    listPlayer.replace({ uri });
    listPlayer.play();
    setPlayingCallId(call.id);
  };

  /** Starts a new call for an existing person */
  const handleLogCallFor = (person: PersonSummary) => {
    setPhone(person.phone);
    setName(person.name);
    setAddress(person.address);
    setCalledAt(new Date());
    resetDetails();
    setVoice(null);
    setTranscript('');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];
  // Inputs inside "More..." sit on a backgroundElement panel, so they use the page background
  const detailInputStyle = [styles.input, { color: theme.text, backgroundColor: theme.background }];

  const rows: ListRow[] =
    view === 'calls'
      ? calls.map((call) => ({ kind: 'call', call }))
      : people.map((person) => ({ kind: 'person', person }));

  const form = (
    <ThemedView style={styles.form}>
      <ThemedText type="subtitle">Log a call</ThemedText>

      <ThemedText type="smallBold">Phone</ThemedText>
      <ThemedView style={styles.row}>
        <TextInput
          style={[inputStyle, styles.flex]}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
        />
        <Pressable onPress={handlePastePhone} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.smallButton}>
            <ThemedText type="smallBold">Paste</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
      {isCallLogAvailable && (
        <Pressable onPress={handleUseLastCall} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.smallButton}>
            <ThemedText type="smallBold">Use last call</ThemedText>
          </ThemedView>
        </Pressable>
      )}

      <ThemedText type="smallBold">Name</ThemedText>
      <TextInput
        style={inputStyle}
        value={name}
        onChangeText={setName}
        placeholder="Who called"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="words"
      />

      <ThemedText type="smallBold">Address</ThemedText>
      <TextInput
        style={inputStyle}
        value={address}
        onChangeText={setAddress}
        placeholder="Street, city"
        placeholderTextColor={theme.textSecondary}
      />

      <ThemedText type="smallBold">When</ThemedText>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={calledAt}
          mode="datetime"
          display="compact"
          onChange={(_, date) => date && setCalledAt(date)}
          style={styles.iosPicker}
        />
      ) : (
        <Pressable
          onPress={Platform.OS === 'android' ? pickDateTimeAndroid : undefined}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.input}>
            <ThemedText>{formatDateTime(calledAt)}</ThemedText>
          </ThemedView>
        </Pressable>
      )}

      <ThemedText type="smallBold">Comment</ThemedText>
      <TextInput
        style={[inputStyle, styles.multiline]}
        value={comment}
        onChangeText={setComment}
        placeholder="What was the call about?"
        placeholderTextColor={theme.textSecondary}
        multiline
      />

      <ThemedText type="smallBold">Voice message</ThemedText>
      <VoiceRecorderField
        value={voice}
        onChange={setVoice}
        transcript={transcript}
        onTranscriptChange={setTranscript}
      />

      <ThemedText type="smallBold">Transcript</ThemedText>
      <TextInput
        style={[inputStyle, styles.multiline]}
        value={transcript}
        onChangeText={setTranscript}
        placeholder="Filled in while you record, or type it here"
        placeholderTextColor={theme.textSecondary}
        multiline
      />

      <ThemedText type="smallBold">Price</ThemedText>
      <TextInput
        style={inputStyle}
        value={price}
        onChangeText={setPrice}
        placeholder="0.00"
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
      />

      <Collapsible title="More...">
        <ThemedView type="backgroundElement" style={styles.form}>
          <ThemedText type="smallBold">Call type</ThemedText>
          <ThemedView type="backgroundElement" style={styles.chips}>
            {CALL_TYPES.map((type) => (
              <Pressable
                key={type}
                // Tapping the selected type again clears it
                onPress={() => setCallType(callType === type ? null : type)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={callType === type ? 'backgroundSelected' : 'background'}
                  style={styles.chip}>
                  <ThemedText
                    type="small"
                    themeColor={callType === type ? 'text' : 'textSecondary'}>
                    {capitalize(type)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="smallBold">Duration</ThemedText>
          <TextInput
            style={detailInputStyle}
            value={duration}
            onChangeText={setDuration}
            placeholder="m:ss, e.g. 5:30"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numbers-and-punctuation"
          />

          <ThemedText type="smallBold">Location</ThemedText>
          <TextInput
            style={detailInputStyle}
            value={location}
            onChangeText={setLocation}
            placeholder="Where the number is from"
            placeholderTextColor={theme.textSecondary}
          />

          <ThemedText type="smallBold">Number type</ThemedText>
          <TextInput
            style={detailInputStyle}
            value={numberLabel}
            onChangeText={setNumberLabel}
            placeholder="Mobile, Home, Work..."
            placeholderTextColor={theme.textSecondary}
          />

          <ThemedText type="smallBold">Country</ThemedText>
          <TextInput
            style={detailInputStyle}
            value={countryIso}
            onChangeText={setCountryIso}
            placeholder="2-letter code, e.g. RS"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            maxLength={2}
          />

          <ThemedView type="backgroundElement" style={styles.switchRow}>
            <ThemedText type="smallBold" style={styles.flex}>
              Video call
            </ThemedText>
            <Switch value={isVideo} onValueChange={setIsVideo} />
          </ThemedView>
        </ThemedView>
      </Collapsible>

      <Pressable onPress={handleSave} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.button}>
          <ThemedText type="smallBold">Save call</ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView type="backgroundElement" style={[styles.segmented, styles.listTitle]}>
        {(
          [
            ['calls', `Calls (${calls.length})`],
            ['people', `People (${people.length})`],
          ] as const
        ).map(([value, label]) => (
          <Pressable key={value} onPress={() => setView(value)} style={styles.flex}>
            <ThemedView
              type={view === value ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.segment}>
              <ThemedText type="smallBold" themeColor={view === value ? 'text' : 'textSecondary'}>
                {label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ThemedView>
    </ThemedView>
  );

  // showPerson is false for calls listed inside a person's card, which need a contrasting background
  const renderCall = (call: PhoneCall, showPerson: boolean) => (
    <Pressable
      key={call.id}
      onLongPress={() => handleDelete(call)}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={showPerson ? 'backgroundElement' : 'background'} style={styles.card}>
        <ThemedView type={showPerson ? 'backgroundElement' : 'background'} style={styles.cardHeader}>
          <ThemedText type="smallBold" style={styles.flex}>
            {showPerson ? displayName(call) : formatDateTime(new Date(call.calledAt))}
          </ThemedText>
          {call.priceCents !== null && (
            <ThemedText type="smallBold">{formatCents(call.priceCents)}</ThemedText>
          )}
        </ThemedView>
        {showPerson && (
          <ThemedText type="small" themeColor="textSecondary">
            {[call.name ? call.phone : '', formatDateTime(new Date(call.calledAt))]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        )}
        {callDetails(call) !== '' && (
          <ThemedText type="small" themeColor="textSecondary">
            {callDetails(call)}
          </ThemedText>
        )}
        <ThemedText type="small">
          <ThemedText type="smallBold">Comments: </ThemedText>
          {call.comment || '—'}
        </ThemedText>
        <ThemedText type="small">
          <ThemedText type="smallBold">Transcript: </ThemedText>
          <ThemedText type="small" style={call.transcript !== '' && styles.transcript}>
            {call.transcript || '—'}
          </ThemedText>
        </ThemedText>
        {call.hasVoice && (
          <Pressable
            onPress={() => handlePlayVoice(call)}
            style={({ pressed }) => [styles.voiceButtonWrap, pressed && styles.pressed]}>
            <ThemedView type="backgroundSelected" style={styles.voiceButton}>
              <ThemedText type="smallBold">
                {playingCallId === call.id && listPlayerStatus.playing ? '❚❚' : '▶'} Voice{' '}
                {formatVoiceDuration(call.voiceDurationMs)}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </ThemedView>
    </Pressable>
  );

  const renderPerson = (person: PersonSummary) => {
    const expanded = expandedPersonId === person.id;
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <Pressable
          onPress={() => setExpandedPersonId(expanded ? null : person.id)}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.cardHeader}>
            <ThemedText type="smallBold" style={styles.flex}>
              {displayName(person)}
            </ThemedText>
            {person.totalCents > 0 && (
              <ThemedText type="smallBold">{formatCents(person.totalCents)}</ThemedText>
            )}
          </ThemedView>
          {person.name !== '' && person.phone !== '' && (
            <ThemedText type="small" themeColor="textSecondary">
              {person.phone}
            </ThemedText>
          )}
          {person.address !== '' && (
            <ThemedText type="small" themeColor="textSecondary">
              {person.address}
            </ThemedText>
          )}
          <ThemedText type="small">
            {person.callCount} {person.callCount === 1 ? 'call' : 'calls'}
            {person.totalDurationSeconds > 0 &&
              ` · ${formatDuration(person.totalDurationSeconds)} talk time`}
            {' · last '}
            {formatDateTime(new Date(person.lastCalledAt))}
          </ThemedText>
        </Pressable>

        {expanded && (
          <ThemedView type="backgroundElement" style={styles.personCalls}>
            {calls.filter((call) => call.personId === person.id).map((call) => renderCall(call, false))}
            <Pressable
              onPress={() => handleLogCallFor(person)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.smallButton}>
                <ThemedText type="smallBold">Log new call from {displayName(person)}</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) =>
              row.kind === 'call' ? `call-${row.call.id}` : `person-${row.person.id}`
            }
            ListHeaderComponent={form}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary">No calls saved yet.</ThemedText>
            }
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.kind === 'call' ? renderCall(item.call, true) : renderPerson(item.person)
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.four,
    // Leave room for the floating tab bar on web
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  smallButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iosPicker: {
    alignSelf: 'flex-start',
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  listTitle: {
    marginTop: Spacing.four,
  },
  segmented: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Spacing.three,
  },
  segment: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  transcript: {
    fontStyle: 'italic',
  },
  voiceButtonWrap: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
  voiceButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  personCalls: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
