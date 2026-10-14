import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatVoiceDuration } from '@/components/voice-recorder-field';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCents } from '@/db/calls';
import {
  countImportedCalls,
  EXPORT_FILE_PREFIX,
  getImportedCalls,
  importExportFiles,
  type ImportedCall,
  type ImportResult,
} from '@/db/imports';
import { getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { fetchDriveExportFiles, getDriveServiceAccountEmail, parseDriveFolderId } from '@/lib/drive-import';
import { callDetails } from '@/lib/format';
import { canRememberFolder, pickExportFiles, readExportFolder, type PickedExportFiles } from '@/lib/import-files';
import { isServerConfigured } from '@/lib/moler-server';

/** Shown for files exported before the exporter's name was saved in them */
const UNKNOWN_USER = 'Unknown user';

type Row =
  | { kind: 'day'; key: string; label: string; count: number; totalCents: number }
  | { kind: 'user'; key: string; label: string; count: number; totalCents: number }
  | { kind: 'call'; key: string; call: ImportedCall };

function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sumCents(calls: ImportedCall[]) {
  return calls.reduce((total, call) => total + (call.priceCents ?? 0), 0);
}

/** Day headers, then one block per user (in order of their first call that day), calls oldest first */
function groupRows(calls: ImportedCall[]): Row[] {
  const days = new Map<string, { date: Date; users: Map<string, ImportedCall[]> }>();
  for (const call of calls) {
    const date = new Date(call.calledAt);
    const key = dayKey(date);
    if (!days.has(key)) days.set(key, { date, users: new Map() });
    const users = days.get(key)!.users;
    const user = call.exportedBy || UNKNOWN_USER;
    if (!users.has(user)) users.set(user, []);
    users.get(user)!.push(call);
  }

  const rows: Row[] = [];
  for (const [key, { date, users }] of days) {
    const dayCalls = [...users.values()].flat();
    rows.push({
      kind: 'day',
      key: `day-${key}`,
      label: date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      count: dayCalls.length,
      totalCents: sumCents(dayCalls),
    });
    for (const [user, userCalls] of users) {
      rows.push({
        kind: 'user',
        key: `user-${key}-${user}`,
        label: user,
        count: userCalls.length,
        totalCents: sumCents(userCalls),
      });
      for (const call of userCalls) rows.push({ kind: 'call', key: `call-${call.id}`, call });
    }
  }
  return rows;
}

/** "content://.../tree/primary%3ADownload%2Fmoler" → "Download/moler" */
function folderLabel(folderUri: string) {
  const decoded = decodeURIComponent(folderUri);
  return decoded.slice(decoded.lastIndexOf(':') + 1) || decoded;
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'call' : 'calls'}`;
}

function totalLabel(count: number, totalCents: number) {
  return totalCents > 0 ? `${countLabel(count)} · ${formatCents(totalCents)}` : countLabel(count);
}

function resultMessage(result: ImportResult, folderName: string, found: number, rangeSelected: boolean) {
  if (found === 0) return `No ${EXPORT_FILE_PREFIX}… files found in ${folderName}.`;
  const parts = [
    `Read ${result.readFiles} ${result.readFiles === 1 ? 'file' : 'files'} from ${folderName}: ${result.importedCalls} new ${result.importedCalls === 1 ? 'call' : 'calls'} imported.`,
  ];
  if (result.duplicateCalls > 0) {
    parts.push(`${countLabel(result.duplicateCalls)} already in the list.`);
  }
  if (rangeSelected && result.skippedCalls > 0) {
    parts.push(`${countLabel(result.skippedCalls)} outside the selected days.`);
  }
  if (result.failedFiles.length > 0) {
    parts.push(`Not moler exports: ${result.failedFiles.join(', ')}.`);
  }
  return parts.join(' ');
}

export default function ImportsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [calls, setCalls] = useState<ImportedCall[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [folderUri, setFolderUri] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [driveLink, setDriveLink] = useState('');
  // The saved link is loaded once; after that the text field is the source of truth
  const [driveLinkLoaded, setDriveLinkLoaded] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');

  const reload = useCallback(async () => {
    const [list, files, savedFolder, savedDriveLink] = await Promise.all([
      getImportedCalls(db, { from, to }),
      countImportedCalls(db),
      getSetting(db, 'importFolderUri'),
      getSetting(db, 'driveFolderLink'),
    ]);
    setCalls(list);
    setImportedCount(files);
    setFolderUri(savedFolder);
    if (!driveLinkLoaded) {
      setDriveLink(savedDriveLink);
      setDriveLinkLoaded(true);
    }
  }, [db, from, to, driveLinkLoaded]);

  // The e-mail to share the Drive folder with; only a hint, so failures (offline, ...) are ignored
  useEffect(() => {
    if (!isServerConfigured) return;
    getDriveServiceAccountEmail()
      .then(setServiceAccountEmail)
      .catch(() => {});
  }, []);

  // Reload when the tab is shown and whenever the date filter changes
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const runImport = async (pick: () => Promise<PickedExportFiles | null>, rememberFolder = canRememberFolder) => {
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pick();
      if (!picked) return;
      const result = await importExportFiles(db, picked.files, { from, to });
      if (rememberFolder) await setSetting(db, 'importFolderUri', picked.folderUri);
      setMessage(resultMessage(result, picked.folderName, picked.files.length, from !== null || to !== null));
      await reload();
    } catch (error) {
      showAlert('Import failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDriveLinkChange = (value: string) => {
    setDriveLink(value);
    setSetting(db, 'driveFolderLink', value.trim());
  };

  const importFromDrive = () => {
    const folderId = parseDriveFolderId(driveLink);
    if (!folderId) {
      showAlert(
        'Paste the folder link',
        'In Google Drive open the folder, tap ⋮ → Share → Copy link, and paste it here.'
      );
      return;
    }
    runImport(async () => {
      const { folderName, files } = await fetchDriveExportFiles(folderId);
      return { folderUri: '', folderName: `Google Drive "${folderName}"`, files };
    }, false);
  };

  const rows = useMemo(() => groupRows(calls), [calls]);
  const totalCents = useMemo(() => sumCents(calls), [calls]);

  const header = (
    <ThemedView style={styles.header}>
      <ThemedText type="subtitle">Imports</ThemedText>
      <ThemedText themeColor="textSecondary">
        Choose a folder with exported files. The calls of every file whose name starts with
        &quot;{EXPORT_FILE_PREFIX}&quot; are imported, only from the selected days if you set them.
        Calls already in the list are skipped, so a folder can be imported again any time.
      </ThemedText>

      <ThemedView style={styles.filters}>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        {from || to ? 'Imports and shows only the selected days.' : 'No days selected: imports and shows all calls.'}
      </ThemedText>

      <Pressable
        onPress={() => runImport(() => pickExportFiles(folderUri || undefined))}
        disabled={busy}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.button}>
          <ThemedText type="smallBold">{busy ? 'Importing…' : 'Choose folder and import'}</ThemedText>
        </ThemedView>
      </Pressable>
      {canRememberFolder && folderUri !== '' && (
        <Pressable
          onPress={() => runImport(() => readExportFolder(folderUri))}
          disabled={busy}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="smallBold">Import again from {folderLabel(folderUri)}</ThemedText>
          </ThemedView>
        </Pressable>
      )}

      {isServerConfigured && (
        <ThemedView style={styles.driveSection}>
          <ThemedText type="smallBold">Google Drive folder</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            value={driveLink}
            onChangeText={handleDriveLinkChange}
            placeholder="Paste the folder link from Drive (Share → Copy link)"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {serviceAccountEmail
              ? `Share the folder with ${serviceAccountEmail} (Viewer) once, so moler can read it.`
              : 'Share the folder with the moler service account (Viewer) once, so moler can read it.'}
          </ThemedText>
          <Pressable onPress={importFromDrive} disabled={busy} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.button}>
              <ThemedText type="smallBold">{busy ? 'Importing…' : 'Import from Google Drive'}</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      )}
      {message && <ThemedText type="small">{message}</ThemedText>}

      <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
        {importedCount === 0
          ? 'Nothing imported yet.'
          : from || to
            ? `${totalLabel(calls.length, totalCents)} in the selected days · ${countLabel(importedCount)} imported in total`
            : totalLabel(calls.length, totalCents)}
      </ThemedText>
    </ThemedView>
  );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') {
      return (
        <ThemedView style={styles.dayHeader}>
          <ThemedText type="smallBold" style={styles.flex}>
            {item.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {totalLabel(item.count, item.totalCents)}
          </ThemedText>
        </ThemedView>
      );
    }
    if (item.kind === 'user') {
      return (
        <ThemedView type="backgroundSelected" style={styles.userHeader}>
          <ThemedText type="smallBold" style={styles.flex}>
            {item.label}
          </ThemedText>
          <ThemedText type="small">{totalLabel(item.count, item.totalCents)}</ThemedText>
        </ThemedView>
      );
    }
    const { call } = item;
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedView type="backgroundElement" style={styles.cardHeader}>
          <ThemedText type="smallBold">
            {new Date(call.calledAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.flex}>
            {call.name || call.phone}
          </ThemedText>
          {call.priceCents !== null && <ThemedText type="smallBold">{formatCents(call.priceCents)}</ThemedText>}
        </ThemedView>
        {(call.name !== '' && call.phone !== '') || call.address !== '' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[call.name ? call.phone : '', call.address].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
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
        {call.voiceMessageMs !== null && (
          <ThemedText type="small" themeColor="textSecondary">
            Voice message {formatVoiceDuration(call.voiceMessageMs)} (not part of the export)
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={header}
          ListEmptyComponent={
            importedCount > 0 ? (
              <ThemedText themeColor="textSecondary">No imported calls in the selected days.</ThemedText>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          renderItem={renderRow}
        />
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
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  driveSection: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
    minHeight: 44,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  summary: {
    marginTop: Spacing.two,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  userHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
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
  transcript: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.7,
  },
});
