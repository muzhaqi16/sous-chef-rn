import { useEffect, useLayoutEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { useAppStore, selectHydrated } from '#store/useAppStore';
import { Telemetry } from '#services/telemetry';
import { WindowBackground } from '#/native/WindowBackground';
import { lightTheme, darkTheme } from '#/theme/themes';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const ThemedStatusBar = () => {
  const { rt } = useUnistyles();
  const isHydrated = useAppStore(selectHydrated);
  const userThemePreference = useAppStore(state => state.theme);

  // Derive theme from user preference + system color scheme directly.
  // Avoids depending on rt.themeName which lags by one render cycle
  // (useTheme's useEffect in App.tsx hasn't synced Unistyles yet).
  const resolvedTheme: 'light' | 'dark' =
    userThemePreference === ThemePreference.DARK
      ? 'dark'
      : userThemePreference === ThemePreference.LIGHT
        ? 'light'
        : rt.colorScheme === 'dark'
          ? 'dark'
          : 'light';

  const barStyle =
    resolvedTheme === 'dark' ? 'light-content' : 'dark-content';

  // Look up bg color from theme definitions, not the potentially-stale
  // useUnistyles() theme object.
  const bgColor =
    resolvedTheme === 'dark'
      ? darkTheme.colors.background
      : lightTheme.colors.background;

  // Sync native window chrome. Skip before hydration to preserve AppDelegate's setup.
  // Status bar text color is handled by overrideUserInterfaceStyle + setNeedsStatusBarAppearanceUpdate
  // in the native WindowBackgroundModule (VC-based status bar appearance).
  useLayoutEffect(() => {
    if (!isHydrated) return;

    WindowBackground.setThemeAndBackground(resolvedTheme, bgColor);
    UnistylesRuntime.setRootViewBackgroundColor(bgColor);
  }, [isHydrated, resolvedTheme, bgColor]);

  // Track theme changes for telemetry
  const prevThemeRef = useRef(rt.themeName);
  useEffect(() => {
    if (isHydrated && prevThemeRef.current !== rt.themeName) {
      Telemetry.trackEvent('theme_changed', {
        from: prevThemeRef.current,
        to: rt.themeName,
      });
      prevThemeRef.current = rt.themeName;
    }
  }, [rt.themeName, isHydrated]);

  // Before hydration, render nothing — AppDelegate's native setup persists.
  if (!isHydrated) return null;

  return <StatusBar barStyle={barStyle} />;
};
