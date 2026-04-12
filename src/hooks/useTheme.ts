import { useEffect } from 'react';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { useIsHydrated, usePreferences } from '#/store/useAppStore';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const useTheme = () => {
  const { rt } = useUnistyles();
  const isHydrated = useIsHydrated();

  const { theme: userThemePreference, setTheme } = usePreferences();

  const systemColorScheme = rt.colorScheme;

  useEffect(() => {
    // Don't touch Unistyles until the store has loaded the user's real preference.
    // Before hydration, userThemePreference is the slice default (e.g. 'LIGHT'),
    // which stomps the correct adaptive theme Unistyles already set from the system.
    if (!isHydrated) return;

    if (userThemePreference === 'SYSTEM') {
      UnistylesRuntime.setAdaptiveThemes(true);
    } else {
      UnistylesRuntime.setAdaptiveThemes(false);
      const targetTheme = userThemePreference === 'DARK' ? 'dark' : 'light';
      if (UnistylesRuntime.themeName !== targetTheme) {
        UnistylesRuntime.setTheme(targetTheme);
      }
    }
  }, [userThemePreference, isHydrated]);

  const effectiveTheme = (rt.themeName || rt.colorScheme || 'light') as
    | 'light'
    | 'dark';

  return {
    theme: effectiveTheme,
    userThemePreference,
    systemColorScheme,
    isFollowingSystem: userThemePreference === 'SYSTEM',
    setTheme,
    setLightTheme: () => setTheme(ThemePreference.LIGHT),
    setDarkTheme: () => setTheme(ThemePreference.DARK),
    setSystemTheme: () => setTheme(ThemePreference.SYSTEM),
  };
};
