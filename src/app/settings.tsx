import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import { getStorageMode, MOLERS_WEB_URL, setStorageMode, type StorageMode } from '@/lib/storage-mode';

const MODES: { mode: StorageMode; title: string; description: string }[] = [
  {
    mode: 'offline',
    title: 'Offline',
    description: 'Calls are stored in the database on this phone. Best for a single user.',
  },
  {
    mode: 'online',
    title: 'Online',
    description:
      'Each saved call is also sent to the moler Web API, into a shared workspace. Best for several ' +
      'users; the workspace is registered on the moler website. Calls stay on this phone as well.',
  },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [mode, setMode] = useState<StorageMode>('offline');
  const [workspace, setWorkspace] = useState('');
  // Saved values are loaded once; after that the screen is the source of truth
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (loaded) return;
      Promise.all([getStorageMode(db), getSetting(db, 'workspace')]).then(([savedMode, savedWorkspace]) => {
        setMode(savedMode);
        setWorkspace(savedWorkspace);
        setLoaded(true);
      });
    }, [db, loaded])
  );

  const chooseMode = (value: StorageMode) => {
    setMode(value);
    setStorageMode(db, value);
  };

  const handleWorkspaceChange = (value: string) => {
    setWorkspace(value);
    setSetting(db, 'workspace', value.trim());
  };



  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Settings</ThemedText>

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Where calls are stored
          </ThemedText>
          {MODES.map((option) => {
            const selected = mode === option.mode;
            return (
              <Pressable
                key={option.mode}
                onPress={() => chooseMode(option.mode)}
                role="radio"
                aria-checked={selected}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={selected ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.option, selected && { borderColor: theme.text }]}>
                  <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.optionHeader}>
                    <ThemedText type="smallBold">{selected ? '◉' : '○'}</ThemedText>
                    <ThemedText type="smallBold">{option.title}</ThemedText>
                  </ThemedView>
                  <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                    {option.description}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}

          {mode === 'online' && (
            <ThemedView style={styles.online}>
              <ThemedText type="smallBold">Workspace</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                value={workspace}
                onChangeText={handleWorkspaceChange}
                placeholder="The workspace you registered, e.g. AutoPlac"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable
                onPress={() => Linking.openURL(MOLERS_WEB_URL)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.button}>
                  <ThemedText type="smallBold">Register a workspace at molers.onrender.com</ThemedText>
                </ThemedView>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary">
                {!workspace.trim()
                  ? 'Enter the workspace to send calls online. Until then calls are only saved on this phone.'
                  : 'New calls are sent to the workspace when you save them. The Calls list shows whether each one was uploaded.'}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
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
  content: {
    padding: Spacing.four,
    // Leave room for the floating tab bar on web
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
  },
  option: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.one,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  online: {
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
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
