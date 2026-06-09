import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface StatusBarScrimProps {
  /**
   * How far below the status-bar inset the gradient fades. Pass a larger value
   * to also keep overlaid header buttons legible, not just the status-bar icons.
   */
  extraHeight?: number;
}

/**
 * Soft top gradient for immersive screens whose content draws edge-to-edge
 * behind the status bar. Fades the app background color in at the very top →
 * transparent so the status-bar icons (and any overlaid header buttons) stay
 * legible over a photo. Because the fade color is the app background and the
 * icons are theme-based (dark in light theme, light in dark theme), contrast
 * holds in both themes.
 *
 * `theme` is read via `useUnistyles()` because react-native-svg can't consume
 * Unistyles styles — the color flows in as a prop. A tiny overlay can afford
 * the theme-change re-render.
 */
export const StatusBarScrim: React.FC<StatusBarScrimProps> = ({
  extraHeight = 24,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const height = insets.top + extraHeight;
  const bg = theme.colors.background;
  // Unique gradient id (colons from useId are invalid inside url(#…)).
  const gradientId = `statusBarScrim-${React.useId().replace(/:/g, '')}`;

  return (
    <Svg
      pointerEvents="none"
      style={[styles.scrim, { height }]}
      width="100%"
      height={height}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bg} stopOpacity={0.9} />
          <Stop offset="0.6" stopColor={bg} stopOpacity={0.45} />
          <Stop offset="1" stopColor={bg} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={height} fill={`url(#${gradientId})`} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
