import { useEffect, useRef } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';
import { useAnimatedTheme as useUnistylesAnimatedTheme } from 'react-native-unistyles/reanimated';
import type { Theme } from '#/theme/themes';

/**
 * Unistyles' animated theme drops its listener while a paused screen is hidden
 * and re-subscribes without re-reading, so a reveal reads the theme again.
 */
export const useAnimatedTheme = () => {
  const theme = useUnistylesAnimatedTheme();
  const themeWhenHidden = useRef<Theme | null>(null);

  useEffect(() => {
    const current = UnistylesRuntime.getTheme();
    if (themeWhenHidden.current && themeWhenHidden.current !== current) {
      theme.set(current);
    }
    themeWhenHidden.current = null;
    return () => {
      themeWhenHidden.current = UnistylesRuntime.getTheme();
    };
  }, [theme]);

  return theme;
};
