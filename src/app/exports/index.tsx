import * as Device from 'expo-device';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  buildFileName,
  countUnexportedCalls,
  createExport,
  getExports,
  getExportXml,
  type CallExport,
} from '@/db/exports';
import { getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { shareXmlFile } from '@/lib/export-file';
import { formatDateTime } from '@/lib/format';

/** Used in the file name when no name or e-mail has been entered, e.g. "HUAWEI Y70" */
const DEVICE_NAME = Device.deviceName ?? '';

export default function ExportsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [exports, setExports] = useState<CallExport[]>([]);
  const [unexportedCount, setUnexportedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporterName, setExporterName] = useState('');
  // The saved name is loaded once; after that the text field is the source of truth
  const [nameLoaded, setNameLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [list, count, savedName] = await Promise.all([
      getExports(db),
      countUnexportedCalls(db),
      getSetting(db, 'exporterName'),
    ]);
    setExports(list);
    setUnexportedCount(count);
    if (!nameLoaded) {
      setExporterName(savedName);
      setNameLoaded(true);
    }
  }, [db, nameLoaded]);

  const handleNameChange = (value: string) => {
    setExporterName(value);
    setSetting(db, 'exporterName', value.trim());
  };

  const exportedBy = exporterName.trim() || DEVICE_NAME;

  // Reload whenever the tab is shown, so calls saved on the Calls tab are counted
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const share = async (callExport: CallExport) => {
    const xml = await getExportXml(db, callExport.id);
    if (xml === null) return;
    try {
      await shareXmlFile(callExport.fileName, xml);
    } catch (error) {
      showAlert('Could not share the export', error instanceof Error ? error.message : String(error));
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const created = await createExport(db, exportedBy);
      await reload();
      if (created) await share(created);
    } catch (error) {
      showAlert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <ThemedView style={styles.header}>
      <ThemedText type="subtitle">Exports</ThemedText>
      <ThemedText themeColor="textSecondary">
        Each export saves the calls that haven&apos;t been exported yet as an XML file and marks
        them as exported.
      </ThemedText>
      <ThemedText type="smallBold">Your name or e-mail</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        value={exporterName}
        onChangeText={handleNameChange}
        placeholder={DEVICE_NAME ? `e.g. ana@example.com (empty: ${DEVICE_NAME})` : 'e.g. ana@example.com'}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <ThemedText type="small" themeColor="textSecondary">
        File name: {buildFileName(exportedBy, new Date())}
      </ThemedText>
      <Pressable
        onPress={handleExport}
        disabled={busy || unexportedCount === 0}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView
          type={unexportedCount === 0 ? 'backgroundElement' : 'backgroundSelected'}
          style={styles.button}>
          <ThemedText
            type="smallBold"
            themeColor={unexportedCount === 0 ? 'textSecondary' : 'text'}>
            {busy
              ? 'Exporting…'
              : unexportedCount === 0
                ? 'No new calls to export'
                : `Export ${unexportedCount} new ${unexportedCount === 1 ? 'call' : 'calls'} to XML`}
          </ThemedText>
        </ThemedView>
      </Pressable>
      {exports.length > 0 && (
        <ThemedText type="smallBold" style={styles.listTitle}>
          Previous exports
        </ThemedText>
      )}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={exports}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary">Nothing has been exported yet.</ThemedText>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/exports/[id]', params: { id: item.id } })}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedView type="backgroundElement" style={styles.cardHeader}>
                  <ThemedText type="smallBold" style={styles.flex}>
                    Export #{item.id}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.callCount} {item.callCount === 1 ? 'call' : 'calls'}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateTime(new Date(item.createdAt))}
                  {item.exportedBy !== '' && ` · ${item.exportedBy}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.fileName}
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
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
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
    minHeight: 44,
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
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
