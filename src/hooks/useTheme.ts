import { useUnistyles } from 'react-native-unistyles';
import { usePreferences } from '#/store/useAppStore';
import { ThemePreference } from '#/store/slices/preferencesSlice';

/**
 * Pure derivation hook over the active theme.
 *
 * `useTheme` performs no side effects. The two paths that drive the
 * Unistyles runtime are:
 *
 *   1. `preferencesSlice.setTheme` — writes to `UnistylesRuntime`
 *      synchronously before notifying subscribers, for in-app toggles.
 *   2. The Zustand persist `onRehydrateStorage` callback in `src/store` —
 *      replays the rehydrated preference once, before `isHydrated` flips.
 *
 * Both paths share the `applyThemePreferenceToRuntime` helper in
 * `preferencesSlice`, so the runtime can never desync from the store.
 */
export const useTheme = () => {
  const { rt } = useUnistyles();
  const { theme: userThemePreference, setTheme } = usePreferences();

  const systemColorScheme = rt.colorScheme;
  const effectiveTheme = (rt.themeName || rt.colorScheme || 'light') as
    | 'light'
    | 'dark';

  return {
    theme: effectiveTheme,
    userThemePreference,
    systemColorScheme,
    isFollowingSystem: userThemePreference === ThemePreference.SYSTEM,
    setTheme,
    setLightTheme: () => setTheme(ThemePreference.LIGHT),
    setDarkTheme: () => setTheme(ThemePreference.DARK),
    setSystemTheme: () => setTheme(ThemePreference.SYSTEM),
  };
};
