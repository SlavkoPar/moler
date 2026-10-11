import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  countUnexportedCalls,
  createExport,
  exportFileName,
  getExports,
  getExportXml,
  type CallExport,
} from '@/db/exports';
import { showAlert } from '@/lib/alert';
import { shareXmlFile } from '@/lib/export-file';
import { formatDateTime } from '@/lib/format';

export default function ExportsScreen() {
  const db = useSQLiteContext();
  const [exports, setExports] = useState<CallExport[]>([]);
  const [unexportedCount, setUnexportedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [list, count] = await Promise.all([getExports(db), countUnexportedCalls(db)]);
    setExports(list);
    setUnexportedCount(count);
  }, [db]);

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
      await shareXmlFile(exportFileName(callExport), xml);
    } catch (error) {
      showAlert('Could not share the export', error instanceof Error ? error.message : String(error));
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const created = await createExport(db);
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
                  {formatDateTime(new Date(item.createdAt))} · {exportFileName(item)}
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
