import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DatabaseErrorBoundary } from '@/components/database-error-boundary';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/calls';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // SQLiteProvider closes and reopens the database whenever onInit changes identity. Holding it in
  // state keeps it stable across Fast Refresh, so editing db code doesn't close the database under
  // screens still using it ("Database not found"). Reload the app to run edited migrations.
  const [onInit] = useState(() => migrateDbIfNeeded);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseErrorBoundary>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={onInit}>
          <AnimatedSplashOverlay />
          <AppTabs />
        </SQLiteProvider>
      </DatabaseErrorBoundary>
    </ThemeProvider>
  );
}
