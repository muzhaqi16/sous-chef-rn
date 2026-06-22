import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface EdgeFadeProps {
  /** Which edge to fade toward (the opaque side sits on this edge). */
  side: 'left' | 'right';
  /** Width of the fade band in px. */
  width?: number;
  /**
   * Which theme color the opaque end blends into — i.e. the surface the
   * scroller sits on. `background` for a screen (default), `surface` for a
   * bottom sheet. A mismatch paints a visible band of the wrong color.
   */
  colorKey?: 'background' | 'surface';
}

/**
 * A horizontal fade overlay for the edge of a scrollable row. Renders a
 * gradient from the screen background (opaque, on `side`) to transparent, so
 * content scrolling under it reads as "there's more to scroll" instead of being
 * hard-clipped at the viewport edge.
 *
 * Decorative only — `pointerEvents="none"` so it never intercepts touches on the
 * chips beneath it. SVG can't consume Unistyles styles, so the background color
 * is read via `useUnistyles` (the documented exception for SVG/Skia draw calls).
 * The Svg fills a sized wrapper View (100%×100%) so its canvas is deterministic;
 * gradient stops are always emitted in ascending offset order (0 → 1) — RN-SVG
 * renders descending stops incorrectly.
 */
export const EdgeFade: React.FC<EdgeFadeProps> = ({
  side,
  width = 24,
  colorKey = 'background',
}) => {
  const { theme } = useUnistyles();
  const bg =
    colorKey === 'surface' ? theme.colors.surface : theme.colors.background;
  // Opaque end sits on `side`; stops stay ascending and direction is set by
  // which end is opaque.
  const startOpacity = side === 'left' ? 1 : 0;
  const endOpacity = side === 'left' ? 0 : 1;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        { width },
        side === 'left' ? styles.left : styles.right,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={`edgeFade-${side}-${colorKey}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <Stop offset="0" stopColor={bg} stopOpacity={startOpacity} />
            <Stop offset="1" stopColor={bg} stopOpacity={endOpacity} />
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill={`url(#edgeFade-${side}-${colorKey})`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  left: { left: 0 },
  right: { right: 0 },
});
