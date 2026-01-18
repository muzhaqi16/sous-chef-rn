import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useShallow } from 'zustand/shallow';
import { UnistylesRuntime } from 'react-native-unistyles';
import { useAppStore, selectPreferences } from '#/store/useAppStore';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const useTheme = () => {
  const systemColorScheme = useColorScheme();
  const {theme: userThemePreference, setTheme} = useAppStore(
    useShallow(selectPreferences),
  );

  // Resolve the effective theme based on user preference and system
  const resolveEffectiveTheme = (): 'light' | 'dark' => {
    switch (userThemePreference) {
      case 'SYSTEM':
        // When user chooses system, follow device preference
        return systemColorScheme === 'dark' ? 'dark' : 'light';
      case 'LIGHT':
        return 'light';
      case 'DARK':
        return 'dark';
      default:
        // Fallback to light
        return 'light';
    }
  };

  const effectiveTheme = resolveEffectiveTheme();

  // Update Unistyles theme when effective theme changes
  // This handles both explicit theme changes and system preference changes
  // since effectiveTheme is derived from both userThemePreference and systemColorScheme
  useEffect(() => {
    // Only set theme if it's different from current
    if (UnistylesRuntime.themeName !== effectiveTheme) {
      UnistylesRuntime.setTheme(effectiveTheme);
    }
  }, [effectiveTheme]);

  return {
    // Current effective theme ('light' or 'dark')
    theme: effectiveTheme,

    // User's theme preference ('LIGHT', 'DARK', or 'SYSTEM')
    userThemePreference,

    // System's color scheme
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
