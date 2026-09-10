import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped, so a caller can pass a ratio. */
  value: number;
  size?: 'sm' | 'md';
  tone?: 'accent' | 'success' | 'warning' | 'error' | 'rating';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A determinate bar. It reports its position to assistive technology as a
 * percentage, which a bare pair of `View`s cannot.
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
  styles.useVariants({ size, tone });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, style]}
      testID={testID}
    >
      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
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
      tone: { accent: {}, success: {}, warning: {}, error: {}, rating: {} },
    },
  },
  fill: {
    height: '100%',
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    variants: {
      size: { sm: {}, md: {} },
      tone: {
        accent: { backgroundColor: theme.colors.primary },
        success: { backgroundColor: theme.colors.success },
        warning: { backgroundColor: theme.colors.warning },
        error: { backgroundColor: theme.colors.error },
        rating: { backgroundColor: theme.colors.rating },
      },
    },
  },
}));

export default ProgressBar;
