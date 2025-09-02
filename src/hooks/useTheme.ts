import {useEffect} from 'react';
import {useColorScheme} from 'react-native';
import {UnistylesRuntime} from 'react-native-unistyles';
import {useStore} from '#/store';

export const useTheme = () => {
  const systemColorScheme = useColorScheme();
  const {theme: userThemePreference, setTheme} = useStore();

  // Resolve the effective theme based on user preference and system
  const resolveEffectiveTheme = (): 'light' | 'dark' => {
    switch (userThemePreference) {
      case 'system':
        // When user chooses system, follow device preference
        return systemColorScheme === 'dark' ? 'dark' : 'light';
      case 'light':
      case 'dark':
        // When user has explicit preference, use it
        return userThemePreference;
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
      userThemePreference === 'system' &&
      UnistylesRuntime.themeName !== effectiveTheme
    ) {
      UnistylesRuntime.setTheme(effectiveTheme);
    }
  }, [systemColorScheme, userThemePreference, effectiveTheme]);

  return {
    // Current effective theme ('light' or 'dark')
    theme: effectiveTheme,

    // User's theme preference ('light', 'dark', or 'system')
    userThemePreference,

    // System's color scheme
    systemColorScheme,

    // Whether we're currently following system preference
    isFollowingSystem: userThemePreference === 'system',

    // Theme setter
    setTheme,

    // Helper methods
    setLightTheme: () => setTheme('light'),
    setDarkTheme: () => setTheme('dark'),
    setSystemTheme: () => setTheme('system'),
  };
};
