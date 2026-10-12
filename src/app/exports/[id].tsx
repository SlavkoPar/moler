import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { formatVoiceDuration } from '@/components/voice-recorder-field';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { displayName, formatCents, getCalls, type PhoneCall } from '@/db/calls';
import { getExport, getExportXml, type CallExport } from '@/db/exports';
import { showAlert } from '@/lib/alert';
import { shareXmlFile } from '@/lib/export-file';
import { callDetails, formatDateTime } from '@/lib/format';

type ExportDetails = {
  callExport: CallExport;
  calls: PhoneCall[];
  xml: string;
};

export default function ExportScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading, null when there is no export with this id
  const [details, setDetails] = useState<ExportDetails | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const exportId = Number(id);
    Promise.all([getExport(db, exportId), getCalls(db, { exportId }), getExportXml(db, exportId)]).then(
      ([callExport, calls, xml]) => {
        if (cancelled) return;
        setDetails(callExport && xml !== null ? { callExport, calls, xml } : null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  const handleShare = async () => {
    if (!details) return;
    try {
      await shareXmlFile(details.callExport.fileName, details.xml);
    } catch (error) {
      showAlert('Could not share the export', error instanceof Error ? error.message : String(error));
    }
  };

  if (details === undefined) {
    return <ThemedView style={styles.fill} />;
  }

  if (details === null) {
    return (
      <ThemedView style={[styles.fill, styles.content]}>
        <Stack.Screen options={{ title: 'Export' }} />
        <ThemedText themeColor="textSecondary">This export no longer exists.</ThemedText>
      </ThemedView>
    );
  }

  const { callExport, calls, xml } = details;
  // Calls deleted after the export are still in the XML, just no longer in the app
  const deletedCount = callExport.callCount - calls.length;

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: `Export #${callExport.id}` }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {Platform.OS === 'web' && (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/exports'))}
              style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
              <ThemedText type="link">← All exports</ThemedText>
            </Pressable>
          )}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Export #{callExport.id}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(new Date(callExport.createdAt))}
              {callExport.exportedBy !== '' && ` · ${callExport.exportedBy}`}
            </ThemedText>
            <ThemedText type="small">
              {callExport.callCount} {callExport.callCount === 1 ? 'call' : 'calls'}
            </ThemedText>
            <ThemedText type="small" selectable>
              {callExport.fileName}
            </ThemedText>
          </ThemedView>

          <Pressable onPress={handleShare} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.button}>
              <ThemedText type="smallBold">
                {Platform.OS === 'web' ? 'Download XML' : 'Share XML file'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Calls in this export
          </ThemedText>
          {deletedCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {deletedCount} {deletedCount === 1 ? 'call was' : 'calls were'} deleted from the app
              since; {deletedCount === 1 ? 'it is' : 'they are'} still in the XML file.
            </ThemedText>
          )}
          {calls.map((call) => (
            <ThemedView key={call.id} type="backgroundElement" style={styles.card}>
              <ThemedView type="backgroundElement" style={styles.cardHeader}>
                <ThemedText type="smallBold" style={styles.flex}>
                  {displayName(call)}
                </ThemedText>
                {call.priceCents !== null && (
                  <ThemedText type="smallBold">{formatCents(call.priceCents)}</ThemedText>
                )}
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                {[call.name ? call.phone : '', formatDateTime(new Date(call.calledAt))]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
              {call.address !== '' && (
                <ThemedText type="small" themeColor="textSecondary">
                  {call.address}
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
                <ThemedText type="small" themeColor="textSecondary">
                  Voice message {formatVoiceDuration(call.voiceDurationMs)} (not included in the XML)
                </ThemedText>
              )}
            </ThemedView>
          ))}

          <ThemedView style={styles.sectionTitle}>
            <Collapsible title="XML">
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="code" selectable>
                  {xml}
                </ThemedText>
              </ThemedView>
            </Collapsible>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    // Leave room for the floating tab bar on web
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
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
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  sectionTitle: {
    marginTop: Spacing.three,
  },
  transcript: {
    fontStyle: 'italic',
  },
  backLink: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
});
