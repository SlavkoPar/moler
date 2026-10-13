import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Props = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
};

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** A day picker that can also be empty ("any"), with a button to clear it */
export function DateField({ label, value, onChange }: Props) {
  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: value ?? new Date(),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date);
      },
    });
  };

  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedView style={styles.row}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            onChange={(_, date) => date && onChange(date)}
          />
        ) : (
          <Pressable onPress={openAndroidPicker} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText themeColor={value ? 'text' : 'textSecondary'}>
                {value ? formatDay(value) : 'Any'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
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
  flex: {
    flex: 1,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
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
