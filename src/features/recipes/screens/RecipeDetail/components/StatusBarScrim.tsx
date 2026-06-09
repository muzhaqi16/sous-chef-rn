import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Fade below the status bar so the theme-based status-bar icons stay legible
// over the hero photo.
const SCRIM_EXTRA_HEIGHT = 24;

/**
 * A soft top gradient that sits over the immersive Recipe Detail hero image.
 *
 * The image draws edge-to-edge behind the status bar, so the clock/battery
 * icons could land on a busy part of a photo. This fades the app background
 * color in at the very top → transparent, giving the icons a consistent
 * backdrop. Because the fade color is the app background and the icons are
 * theme-based (dark in light theme, light in dark theme), contrast holds in
 * both themes.
 *
 * Read of `theme` via `useUnistyles()` is intentional — react-native-svg can't
 * consume Unistyles styles, so the color flows in as a prop (same pattern as
 * the Skia chart). It re-renders on theme change, which a tiny overlay can
 * afford.
 */
export const StatusBarScrim: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const height = insets.top + SCRIM_EXTRA_HEIGHT;
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
