import { useEffect, useLayoutEffect, useRef } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { Telemetry } from '#services/telemetry';
import { WindowBackground } from '#/native/WindowBackground';
import { ThemePreference } from '#/store/slices/preferencesSlice';

export const ThemedStatusBar = () => {
  const { rt } = useUnistyles();
  const isHydrated = useIsHydrated();
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

  // Read from the *registered* Unistyles theme so any runtime overrides
  // applied by `useAppearance` (e.g. high-contrast text or a future
  // background tweak) flow through. Static module imports would snapshot
  // the original `themes.ts` exports and skip live overrides.
  const bgColor = UnistylesRuntime.getTheme(resolvedTheme).colors.background;

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

  return <SystemBars style={barStyle} hidden={false} />;
};
