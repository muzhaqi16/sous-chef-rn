import React, { useLayoutEffect, useRef, useState } from 'react';
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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
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
  /** When true, renders as an overlay View instead of a Modal so gestures
   *  pass through the hole area to the underlying content (e.g. swipeable items). */
  allowGesturePassthrough?: boolean;
  /** Called when the user swipes left to advance to the next step */
  onNext?: () => void;
}

const HOLE_PADDING = 8;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_WIDTH = 275;
const ARROW_SIZE = 10;
// Border large enough to cover the entire screen around the hole
const DIM_BORDER = 2000;
const SWIPE_THRESHOLD = 50;

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
  allowGesturePassthrough,
  onNext,
}) => {
  const { theme } = useUnistyles();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // In passthrough mode the overlay is a View inside the screen container,
  // not a full-screen Modal. Page coordinates from measure() must be converted
  // to overlay-local coordinates by subtracting the overlay's own page offset.
  const overlayRef = useRef<View>(null);
  const [overlayPageOffset, setOverlayPageOffset] = useState<{
    x: number;
    y: number;
  } | null>(allowGesturePassthrough ? null : { x: 0, y: 0 });

  // Reset offset when passthrough mode activates so we re-measure.
  // Uses "adjusting state during render" pattern (no effect needed).
  const [prevPassthrough, setPrevPassthrough] = useState(
    allowGesturePassthrough,
  );
  if (prevPassthrough !== allowGesturePassthrough) {
    setPrevPassthrough(allowGesturePassthrough);
    if (allowGesturePassthrough) {
      setOverlayPageOffset(null);
    } else {
      setOverlayPageOffset({ x: 0, y: 0 });
    }
  }

  const handleOverlayLayout = () => {
    if (!allowGesturePassthrough) return;
    requestAnimationFrame(() => {
      overlayRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        setOverlayPageOffset({ x: pageX, y: pageY });
      });
    });
  };

  // Adjust target rect: page coords → overlay-local coords
  const adjustedRect =
    overlayPageOffset != null
      ? {
          x: targetRect.x - overlayPageOffset.x,
          y: targetRect.y - overlayPageOffset.y,
          width: targetRect.width,
          height: targetRect.height,
        }
      : targetRect;

  const borderRadius = theme.radii.md;

  // Padded hole dimensions
  const holeTop = adjustedRect.y - HOLE_PADDING;
  const holeLeft = adjustedRect.x - HOLE_PADDING;
  const holeWidth = adjustedRect.width + HOLE_PADDING * 2;
  const holeHeight = adjustedRect.height + HOLE_PADDING * 2;
  const holeBottom = holeTop + holeHeight;

  // Determine if tooltip goes above or below
  const showAbove = adjustedRect.y > screenHeight / 2;

  // ── Shared values ──
  const pulseOpacity = useSharedValue(1);
  const tooltipTranslateY = useSharedValue(showAbove ? 10 : -10);
  const tooltipOpacity = useSharedValue(0);

  // Detect step changes — cross-fade tooltip.
  // Uses "adjusting state during render" pattern (no effect needed).
  const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
  if (prevStepIndex !== stepIndex) {
    setPrevStepIndex(stepIndex);
    // Cross-fade tooltip (fade out → position snaps while invisible → fade in)
    tooltipOpacity.set(
      withSequence(
        withTiming(0, { duration: TIMING.INSTANT }),
        withTiming(1, { duration: TIMING.FAST }),
      ),
    );
  }

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

  // ── Animated styles ──

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

  // Swipe-to-advance gesture (left swipe → next step)
  // Pre-defined RN-scope callback for scheduleOnRN (CLAUDE.md convention)
  const handleSwipeAdvance = () => {
    onNext?.();
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd(event => {
      'worklet';
      if (event.translationX < -SWIPE_THRESHOLD) {
        scheduleOnRN(handleSwipeAdvance);
      }
    })
    .enabled(!!onNext && !allowGesturePassthrough);

  // Clamp tooltip horizontally within screen
  const tooltipHalf = TOOLTIP_WIDTH / 2;
  const tooltipLeft = Math.max(
    theme.spacing.md,
    Math.min(
      adjustedRect.x + adjustedRect.width / 2 - tooltipHalf,
      screenWidth - TOOLTIP_WIDTH - theme.spacing.md,
    ),
  );

  // Arrow horizontal position relative to tooltip, clamped within bounds
  const arrowLeftRaw =
    adjustedRect.x + adjustedRect.width / 2 - tooltipLeft - ARROW_SIZE / 2;
  const arrowLeft = Math.max(
    theme.spacing.lg,
    Math.min(arrowLeftRaw, TOOLTIP_WIDTH - ARROW_SIZE - theme.spacing.lg),
  );

  const overlay = (
    <GestureDetector gesture={swipeGesture}>
      <View
        ref={allowGesturePassthrough ? overlayRef : undefined}
        collapsable={!allowGesturePassthrough}
        style={[
          styles.fullScreen,
          allowGesturePassthrough && styles.passthroughContainer,
        ]}
        pointerEvents={allowGesturePassthrough ? 'box-none' : undefined}
      >
        {/* Dismiss overlay — covers entire screen, handles taps outside the hole */}
        {!allowGesturePassthrough && (
          <Pressable style={styles.dismissArea} onPress={onDismiss} />
        )}

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

        {/* Transparent hole tap target — omitted in passthrough mode so
          gestures reach the underlying content (e.g. swipeable items) */}
        {!allowGesturePassthrough && (
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
        )}

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
          {onNext ? (
            <Pressable onPress={onNext} style={styles.nextButton} hitSlop={8}>
              <Text style={styles.nextButtonText}>Next ›</Text>
            </Pressable>
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
    </GestureDetector>
  );

  if (allowGesturePassthrough) {
    // Wait for the overlay to measure its page offset before showing content
    // to avoid a single-frame flash at the wrong position
    if (overlayPageOffset === null) {
      return (
        <View
          ref={overlayRef}
          collapsable={false}
          style={[styles.fullScreen, styles.passthroughContainer]}
          pointerEvents="box-none"
          onLayout={handleOverlayLayout}
        />
      );
    }
    return overlay;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <GestureHandlerRootView style={styles.fullScreen}>
        {overlay}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  passthroughContainer: {
    zIndex: 9999,
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
  nextButton: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  nextButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
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
