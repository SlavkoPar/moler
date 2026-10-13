import { createElement } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
};

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The browser's own date input; empty means "any" */
export function DateField({ label, value, onChange }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedView style={styles.row}>
        {createElement('input', {
          type: 'date',
          'aria-label': label,
          value: value ? toInputValue(value) : '',
          onChange: (event: { target: { value: string } }) => {
            const [year, month, day] = event.target.value.split('-').map(Number);
            onChange(year ? new Date(year, month - 1, day) : null);
          },
          style: {
            flex: 1,
            minHeight: 44,
            boxSizing: 'border-box',
            padding: `0 ${Spacing.three}px`,
            border: 'none',
            borderRadius: Spacing.three,
            font: 'inherit',
            fontSize: 16,
            color: theme.text,
            backgroundColor: theme.backgroundElement,
          },
        })}
        {value && (
          <Pressable onPress={() => onChange(null)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.clear}>
              <ThemedText type="smallBold">✕</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  clear: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
