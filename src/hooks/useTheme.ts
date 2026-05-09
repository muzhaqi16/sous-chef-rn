import { useEffect } from 'react';
import { useUnistyles, UnistylesRuntime } from 'react-native-unistyles';
import { useIsHydrated, usePreferences } from '#/store/useAppStore';
import { storeApi } from '#/store';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const useTheme = () => {
  const { rt } = useUnistyles();
  const isHydrated = useIsHydrated();

  const { theme: userThemePreference, setTheme } = usePreferences();

  const systemColorScheme = rt.colorScheme;

  // After the persisted store hydrates, sync Unistyles to the rehydrated user
  // preference *once*. In-app preference changes are handled by
  // `preferencesSlice.setTheme`, which writes to `UnistylesRuntime`
  // synchronously before notifying subscribers — re-running this effect on
  // every preference change would be a redundant second write. Depending only
  // on `isHydrated` (which transitions false → true exactly once) keeps it
  // one-shot, and reading the preference via `getState()` avoids a stale
  // closure without subscribing to it.
  useEffect(() => {
    if (!isHydrated) return;
    const pref = storeApi.getState().theme;

    if (pref === ThemePreference.SYSTEM) {
      UnistylesRuntime.setAdaptiveThemes(true);
    } else {
      UnistylesRuntime.setAdaptiveThemes(false);
      const targetTheme = pref === ThemePreference.DARK ? 'dark' : 'light';
      if (UnistylesRuntime.themeName !== targetTheme) {
        UnistylesRuntime.setTheme(targetTheme);
      }
    }
  }, [isHydrated]);

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
