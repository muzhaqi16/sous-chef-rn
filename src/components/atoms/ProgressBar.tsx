import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#theme/motion';

type Tone = 'accent' | 'success' | 'warning' | 'error' | 'rating';

const TONE_COLOR: Record<
  Tone,
  'primary' | 'success' | 'warning' | 'error' | 'rating'
> = {
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
  rating: 'rating',
};

// Attached from the fill's first commit, so the first value shows at once and
// every later one slides. Verified: #reanimated-css-transitions-need-a-baseline-commit.
const SLIDE: CSSTransitionProperties = {
  transitionProperty: 'width',
  transitionDuration: motion.timing.MODERATE,
  transitionTimingFunction: motion.cssEasing.standard,
};

// Plain values, not a Unistyles style: the transition animates what the style
// prop carries.
const filled = (ratio: number): ViewStyle => ({
  height: '100%',
  width: `${ratio * 100}%`,
});

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped, so a caller can pass a ratio. */
  value: number;
  size?: 'sm' | 'md';
  tone?: Tone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A determinate bar. It reports its position to assistive technology as a
 * percentage, which a bare pair of `View`s cannot. A change of value slides the
 * fill; the first value shows at once.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  size = 'sm',
  tone = 'accent',
  accessibilityLabel,
  style,
  testID,
}) => {
  const ratio = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const variantStyles = styles.useVariants({ size });
  // Reanimated's CSS transitions ignore reduce motion.
  // Verified: #reanimated-css-transitions-ignore-reduce-motion.
  const motionEnabled = useMotionEnabled();
  // The fill animates, so its themed values are read in a theme-only worklet.
  const animatedTheme = useAnimatedTheme();
  const fillThemeStyle = useAnimatedStyle(() => {
    const theme = animatedTheme.get();
    return {
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors[TONE_COLOR[tone]],
    };
  });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[variantStyles.track, style]}
      testID={testID}
    >
      <Animated.View
        style={[fillThemeStyle, filled(ratio), motionEnabled ? SLIDE : null]}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  track: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    overflow: 'hidden',
    variants: {
      size: {
        sm: { height: theme.spacing.xs },
        md: { height: theme.spacing.sm },
      },
    },
  },
}));
