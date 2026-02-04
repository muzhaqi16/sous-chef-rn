import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { useAppStore, selectPreferences } from '#/store/useAppStore';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const useTheme = () => {
  // Use Unistyles' native runtime for theme detection instead of React Native's useColorScheme
  // This ensures consistency as Unistyles uses its own C++ layer for theme detection
  const { rt } = useUnistyles();
  const { theme: userThemePreference, setTheme } = useAppStore(
    useShallow(selectPreferences),
  );

  // Get system color scheme from Unistyles runtime
  const systemColorScheme = rt.colorScheme;

  // Handle user preference changes
  useEffect(() => {
    if (userThemePreference === 'SYSTEM') {
      // Enable adaptive themes to follow system preference natively
      UnistylesRuntime.setAdaptiveThemes(true);
    } else {
      // Disable adaptive themes and set explicit theme
      UnistylesRuntime.setAdaptiveThemes(false);
      const targetTheme = userThemePreference === 'DARK' ? 'dark' : 'light';
      if (UnistylesRuntime.themeName !== targetTheme) {
        UnistylesRuntime.setTheme(targetTheme);
      }
    }
  }, [userThemePreference]);

  // Get the current effective theme from Unistyles runtime
  const effectiveTheme = (UnistylesRuntime.themeName || 'light') as 'light' | 'dark';

  return {
    // Current effective theme ('light' or 'dark')
    theme: effectiveTheme,

    // User's theme preference ('LIGHT', 'DARK', or 'SYSTEM')
    userThemePreference,

    // System's color scheme from Unistyles runtime
    systemColorScheme,

    // Whether we're currently following system preference
    isFollowingSystem: userThemePreference === 'SYSTEM',

    // Theme setter
    setTheme,

    // Helper methods
    setLightTheme: () => setTheme(ThemePreference.LIGHT),
    setDarkTheme: () => setTheme(ThemePreference.DARK),
    setSystemTheme: () => setTheme(ThemePreference.SYSTEM),
  };
};
