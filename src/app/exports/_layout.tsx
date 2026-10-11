import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ExportsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* On web the floating tab bar would cover the header, so the screen shows its own back link */}
      <Stack.Screen name="[id]" options={{ title: 'Export', headerShown: Platform.OS !== 'web' }} />
    </Stack>
  );
}
