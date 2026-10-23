import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type RampStop = { offset: number; opacity: number };

/**
 * The right band's opacity toward its opaque edge, on a smoothstep curve: a
 * straight ramp shows a hard start and end, this one eases in and out. Offsets
 * ascend; RN-SVG renders descending stops incorrectly.
 */
const RIGHT_RAMP: readonly RampStop[] = [
  { offset: 0, opacity: 0 },
  { offset: 0.2, opacity: 0.1 },
  { offset: 0.4, opacity: 0.35 },
  { offset: 0.6, opacity: 0.65 },
  { offset: 0.8, opacity: 0.9 },
  { offset: 1, opacity: 1 },
];

// The same ramp mirrored, its offsets ascending again.
const LEFT_RAMP: readonly RampStop[] = RIGHT_RAMP.map(
  ({ offset, opacity }) => ({ offset: 1 - offset, opacity }),
).reverse();

interface EdgeFadeProps {
  /** Which edge to fade toward (the opaque side sits on this edge). */
  side: 'left' | 'right';
  /** Width of the fade band in pt. */
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
  width = 56,
  colorKey = 'background',
}) => {
  const { theme } = useUnistyles();
  const bg =
    colorKey === 'surface' ? theme.colors.surface : theme.colors.background;
  const stops = side === 'right' ? RIGHT_RAMP : LEFT_RAMP;

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
            {stops.map(({ offset, opacity }) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor={bg}
                stopOpacity={opacity}
              />
            ))}
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
