import React, { useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Modal, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  Pressable,
} from 'react-native-gesture-handler';
import {
  Canvas,
  Group,
  Rect as SkRect,
  RoundedRect as SkRoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SPRING, TIMING, standardEasing } from '#constants/animations';

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
const SWIPE_THRESHOLD = 50;
const HOLE_TIMING_CONFIG = { duration: TIMING.SLOW, easing: standardEasing };

/**
 * Spotlight overlay that highlights a target element with a dimmed background.
 * Uses four dim strips (top, bottom, left, right) around the hole to create
 * the overlay, so position can be smoothly animated with Reanimated.
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

  const holeTop = adjustedRect.y - HOLE_PADDING;
  const holeLeft = adjustedRect.x - HOLE_PADDING;
  const holeWidth = adjustedRect.width + HOLE_PADDING * 2;
  const holeHeight = adjustedRect.height + HOLE_PADDING * 2;
  const holeBottom = holeTop + holeHeight;

  const showAbove = adjustedRect.y > screenHeight / 2;

  // ── Shared values ──
  const pulseOpacity = useSharedValue(1);
  const tooltipTranslateY = useSharedValue(showAbove ? 10 : -10);
  const tooltipOpacity = useSharedValue(0);

  // Animated hole geometry for smooth step transitions
  const animHoleTop = useSharedValue(holeTop);
  const animHoleLeft = useSharedValue(holeLeft);
  const animHoleWidth = useSharedValue(holeWidth);
  const animHoleHeight = useSharedValue(holeHeight);

  // Detect step changes — animate hole + cross-fade tooltip.
  // Uses "adjusting state during render" pattern (no effect needed).
  const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
  const [prevAdjustedRect, setPrevAdjustedRect] = useState(adjustedRect);

  const stepChanged = prevStepIndex !== stepIndex;
  const rectChanged =
    prevAdjustedRect.x !== adjustedRect.x ||
    prevAdjustedRect.y !== adjustedRect.y ||
    prevAdjustedRect.width !== adjustedRect.width ||
    prevAdjustedRect.height !== adjustedRect.height;

  if (stepChanged) {
    setPrevStepIndex(stepIndex);
    setPrevAdjustedRect(adjustedRect);

    // Animate hole to new position with eased timing
    animHoleTop.set(withTiming(holeTop, HOLE_TIMING_CONFIG));
    animHoleLeft.set(withTiming(holeLeft, HOLE_TIMING_CONFIG));
    animHoleWidth.set(withTiming(holeWidth, HOLE_TIMING_CONFIG));
    animHoleHeight.set(withTiming(holeHeight, HOLE_TIMING_CONFIG));

    // Cross-fade tooltip (fade out → wait for hole to settle → fade in)
    tooltipOpacity.set(
      withSequence(
        withTiming(0, { duration: TIMING.INSTANT }),
        withDelay(TIMING.STANDARD, withTiming(1, { duration: TIMING.FAST })),
      ),
    );
  } else if (rectChanged) {
    setPrevAdjustedRect(adjustedRect);
    // Rect changed without step change (layout shift) — snap instantly
    animHoleTop.set(holeTop);
    animHoleLeft.set(holeLeft);
    animHoleWidth.set(holeWidth);
    animHoleHeight.set(holeHeight);
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

    return () => {
      cancelAnimation(pulseOpacity);
    };
  }, [pulseOpacity, tooltipTranslateY, tooltipOpacity, showAbove]);

  // ── Animated styles ──

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.get(),
    transform: [{ translateY: tooltipTranslateY.get() }],
  }));

  // Skia clip path for the hole cutout — replaces 4 dim strip views that
  // animated layout properties (top/left/width/height) with a single Canvas
  // draw call, eliminating per-frame layout passes.
  const overlayColor = theme.colors.overlays.heavy;
  const primaryColor = theme.colors.primary;

  const holePath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(
          animHoleLeft.get(),
          animHoleTop.get(),
          animHoleWidth.get(),
          animHoleHeight.get(),
        ),
        borderRadius,
        borderRadius,
      ),
    );
    return path;
  });

  // Swipe-to-advance gesture (left swipe → next step)
  // Pre-defined RN-scope callback for scheduleOnRN (CLAUDE.md convention)
  const handleSwipeAdvance = () => {
    onNext?.();
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd(event => {
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

        {/* Dim overlay with cutout + pulse ring — single Skia Canvas replaces
           4 Animated.View dim strips and 1 pulse ring that animated layout
           properties (top/left/width/height). Canvas draws to one surface,
           avoiding per-view layout passes on every frame. */}
        <Canvas style={styles.fullScreen} pointerEvents="none">
          <Group clip={holePath} invertClip>
            <SkRect
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
              color={overlayColor}
            />
          </Group>
          <SkRoundedRect
            x={animHoleLeft}
            y={animHoleTop}
            width={animHoleWidth}
            height={animHoleHeight}
            r={borderRadius}
            style="stroke"
            strokeWidth={2}
            color={primaryColor}
            opacity={pulseOpacity}
          />
        </Canvas>

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
            onPress={onTargetPress}
            testID="spotlight-target"
          />
        )}

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
          {totalSteps != null &&
          stepIndex != null &&
          stepIndex >= totalSteps - 1 ? (
            <Pressable
              onPress={onDismiss}
              style={styles.nextButton}
              hitSlop={8}
            >
              <Text style={styles.nextButtonText}>Done</Text>
            </Pressable>
          ) : onNext ? (
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
          style={styles.passthroughMeasure}
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
  passthroughMeasure: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  holeTap: {
    position: 'absolute',
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
    color: theme.colors.white,
  },
}));
