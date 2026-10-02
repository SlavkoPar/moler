import { Component, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Shows a readable message instead of a blank screen when the database cannot be opened */
export class DatabaseErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleRetry = () => {
    if (Platform.OS === 'web') {
      // The browser only releases the database file lock on a full page load
      window.location.reload();
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Browsers let only one tab at a time hold the database file
    const lockedByOtherTab = /Access Handle/i.test(error.message);

    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">
          {lockedByOtherTab ? 'Open in another tab' : 'Database error'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.message}>
          {lockedByOtherTab
            ? 'This app is already open in another browser tab. Close the other tab, then reload.'
            : error.message}
        </ThemedText>
        <Pressable onPress={this.handleRetry} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="smallBold">{Platform.OS === 'web' ? 'Reload' : 'Try again'}</ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  message: {
    textAlign: 'center',
    maxWidth: 400,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
