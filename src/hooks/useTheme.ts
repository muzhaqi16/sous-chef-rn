import { useUnistyles } from 'react-native-unistyles';
import { usePreferences } from '#store/useAppStore';
import { ThemePreference } from '#/store/slices/preferenceTypes';

/**
 * Pure derivation over the active theme — no side effects. The Unistyles runtime
 * is driven by `preferencesSlice.setTheme` and the persist `onRehydrateStorage`
 * callback, both through `applyThemePreferenceToRuntime`.
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
