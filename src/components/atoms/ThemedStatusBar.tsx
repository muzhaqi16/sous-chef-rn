import { useEffect, useLayoutEffect, useRef } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
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

  const barStyle = resolvedTheme === 'dark' ? 'light' : 'dark';

  const bgColor =
    resolvedTheme === 'dark'
      ? darkTheme.colors.background
      : lightTheme.colors.background;

  // Sync native theme: root view background (cross-platform) and iOS system UI style.
  // Skip before hydration to preserve AppDelegate's setup.
  useLayoutEffect(() => {
    if (!isHydrated) return;

    UnistylesRuntime.setRootViewBackgroundColor(bgColor);
    WindowBackground.setTheme(resolvedTheme);
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

  return <SystemBars style={barStyle} />;
};
