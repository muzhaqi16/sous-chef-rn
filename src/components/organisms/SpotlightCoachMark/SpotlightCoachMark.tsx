import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SPRING, TIMING } from '#constants/animations';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpotlightCoachMarkProps {
  targetRect: TargetRect;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  /** Called when the user taps the highlighted target area */
  onTargetPress?: () => void;
  /** Current step index (0-based) for multi-step tutorials */
  stepIndex?: number;
  /** Total number of steps in the tutorial sequence */
  totalSteps?: number;
}

const HOLE_PADDING = 8;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_WIDTH = 275;
const ARROW_SIZE = 10;
// Border large enough to cover the entire screen around the hole
const DIM_BORDER = 2000;

/**
 * Spotlight overlay that highlights a target element with a dimmed background.
 * Uses a single View with a massive borderWidth to create the dim overlay,
 * so the hole inherits borderRadius for perfectly rounded corners.
 */
export const SpotlightCoachMark: React.FC<SpotlightCoachMarkProps> = ({
  targetRect,
  title,
  subtitle,
  onDismiss,
  onTargetPress,
  stepIndex,
  totalSteps,
}) => {
  const { theme } = useUnistyles();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const borderRadius = theme.radii.md;

  // Padded hole dimensions
  const holeTop = targetRect.y - HOLE_PADDING;
  const holeLeft = targetRect.x - HOLE_PADDING;
  const holeWidth = targetRect.width + HOLE_PADDING * 2;
  const holeHeight = targetRect.height + HOLE_PADDING * 2;
  const holeBottom = holeTop + holeHeight;

  // Determine if tooltip goes above or below
  const showAbove = targetRect.y > screenHeight / 2;

  // Pulse animation — opacity-only breathing (no scale to stay within hole bounds)
  const pulseOpacity = useSharedValue(1);
  const tooltipTranslateY = useSharedValue(showAbove ? 10 : -10);
  const tooltipOpacity = useSharedValue(0);

  useLayoutEffect(() => {
    // Pulse ring — gentle opacity breathing
    pulseOpacity.set(
      withDelay(
        TIMING.STANDARD,
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 800 }),
            withTiming(1, { duration: 800 }),
          ),
          -1,
          true,
        ),
      ),
    );

    // Tooltip entry
    tooltipOpacity.set(
      withDelay(100, withTiming(1, { duration: TIMING.STANDARD })),
    );
    tooltipTranslateY.set(withDelay(100, withSpring(0, SPRING.GENTLE)));
  }, [pulseOpacity, tooltipTranslateY, tooltipOpacity, showAbove]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ translateY: tooltipTranslateY.value }],
  }));

  const handleTargetTap = () => {
    onTargetPress?.();
  };

  // Clamp tooltip horizontally within screen
  const tooltipHalf = TOOLTIP_WIDTH / 2;
  const tooltipLeft = Math.max(
    theme.spacing.md,
    Math.min(
      targetRect.x + targetRect.width / 2 - tooltipHalf,
      screenWidth - TOOLTIP_WIDTH - theme.spacing.md,
    ),
  );

  // Arrow horizontal position relative to tooltip, clamped within bounds
  const arrowLeftRaw =
    targetRect.x + targetRect.width / 2 - tooltipLeft - ARROW_SIZE / 2;
  const arrowLeft = Math.max(
    theme.spacing.lg,
    Math.min(arrowLeftRaw, TOOLTIP_WIDTH - ARROW_SIZE - theme.spacing.lg),
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.fullScreen}>
        {/* Dismiss overlay — covers entire screen, handles taps outside the hole */}
        <Pressable style={styles.dismissArea} onPress={onDismiss} />

        {/* Dim overlay with rounded hole — uses a massive border to dim the screen */}
        <View
          style={[
            styles.dimWithHole,
            {
              top: holeTop - DIM_BORDER,
              left: holeLeft - DIM_BORDER,
              width: holeWidth + DIM_BORDER * 2,
              height: holeHeight + DIM_BORDER * 2,
              borderWidth: DIM_BORDER,
              borderRadius: DIM_BORDER + borderRadius,
            },
          ]}
          pointerEvents="none"
        />

        {/* Transparent hole tap target */}
        <Pressable
          style={[
            styles.holeTap,
            {
              top: holeTop,
              left: holeLeft,
              width: holeWidth,
              height: holeHeight,
              borderRadius,
            },
          ]}
          onPress={handleTargetTap}
          testID="spotlight-target"
        />

        {/* Pulsing ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              top: holeTop,
              left: holeLeft,
              width: holeWidth,
              height: holeHeight,
              borderRadius,
              borderColor: theme.colors.primary,
            },
            pulseAnimatedStyle,
          ]}
          pointerEvents="none"
        />

        {/* Tooltip card */}
        <Animated.View
          style={[
            styles.tooltip,
            {
              left: tooltipLeft,
              width: TOOLTIP_WIDTH,
              ...(showAbove
                ? {
                    bottom:
                      screenHeight - holeTop + TOOLTIP_MARGIN + ARROW_SIZE,
                  }
                : { top: holeBottom + TOOLTIP_MARGIN + ARROW_SIZE }),
            },
            tooltipAnimatedStyle,
          ]}
        >
          {/* Arrow */}
          <View
            style={[
              styles.arrow,
              {
                left: arrowLeft,
                backgroundColor: theme.colors.surface,
                ...(showAbove
                  ? { bottom: -ARROW_SIZE / 2 }
                  : { top: -ARROW_SIZE / 2 }),
              },
            ]}
          />

          <Text style={styles.tooltipTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.tooltipSubtitle}>{subtitle}</Text>
          ) : null}
          {totalSteps != null && stepIndex != null && totalSteps > 1 ? (
            <View style={styles.stepIndicator}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        i === stepIndex
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>

        {/* Skip button — position adapts to avoid overlapping the target hole */}
        <Pressable
          onPress={onDismiss}
          style={[
            styles.skipButton,
            // If hole overlaps the default skip position (top-right),
            // move skip to the left side
            holeTop < theme.spacing.xl * 3 &&
            holeLeft + holeWidth > screenWidth / 2
              ? { right: undefined, left: theme.spacing.lg }
              : undefined,
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
        >
          <Text style={styles.skipText}>
            {totalSteps != null && totalSteps > 1 ? 'Skip all' : 'Skip'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  dimWithHole: {
    position: 'absolute',
    borderColor: theme.colors.overlays.heavy,
  },
  holeTap: {
    position: 'absolute',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 12,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.3)',
      },
    ],
  },
  arrow: {
    position: 'absolute',
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    transform: [{ rotate: '45deg' }],
  },
  tooltipTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  tooltipSubtitle: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skipButton: {
    position: 'absolute',
    top: theme.spacing.xl * 2,
    right: theme.spacing.lg,
    zIndex: 10,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  skipText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textTertiary,
  },
}));
