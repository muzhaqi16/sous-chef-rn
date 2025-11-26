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
  useEffect(() => {
    // Only set theme if it's different from current
    if (UnistylesRuntime.themeName !== effectiveTheme) {
      UnistylesRuntime.setTheme(effectiveTheme);
    }
  }, [effectiveTheme]);

  // Update system theme detection when system changes (only if user prefers system)
  useEffect(() => {
    if (
      userThemePreference === 'SYSTEM' &&
      UnistylesRuntime.themeName !== effectiveTheme
    ) {
      UnistylesRuntime.setTheme(effectiveTheme);
    }
  }, [systemColorScheme, userThemePreference, effectiveTheme]);

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
