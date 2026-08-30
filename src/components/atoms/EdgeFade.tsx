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
   * The surface the scroller sits on: `background` for a screen, `surface` for a
   * bottom sheet. A mismatch paints a visible band of the wrong color.
   */
  colorKey?: 'background' | 'surface';
}

/**
 * Decorative horizontal fade at the edge of a scrollable row. SVG can't consume
 * Unistyles styles, so the color comes from `useUnistyles` (the documented
 * SVG/Skia exception). Gradient stops must stay in ascending offset order —
 * RN-SVG renders descending stops incorrectly.
 */
export const EdgeFade: React.FC<EdgeFadeProps> = ({
  side,
  width = 24,
  colorKey = 'background',
}) => {
  const { theme } = useUnistyles();
  const bg =
    colorKey === 'surface' ? theme.colors.surface : theme.colors.background;
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
