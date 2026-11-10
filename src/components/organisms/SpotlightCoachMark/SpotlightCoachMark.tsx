import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {
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
  usePanGesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Pressable, Modal } from '#components/atoms/themedComponents';
import {
  Canvas,
  Group,
  Rect as SkRect,
  RoundedRect as SkRoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  HOLE_PADDING,
  TOOLTIP_MARGIN,
  TOOLTIP_MAX_WIDTH,
  ARROW_SIZE,
  SWIPE_THRESHOLD,
  HOLE_TIMING_CONFIG,
} from './spotlightConstants';
import { SpotlightTooltip } from './SpotlightTooltip';
import { GestureDemo } from './GestureDemo';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#/theme/motion';
import { kitTestIDs } from '#components/testIDs';

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** A round target gets a round hole. */
  shape?: 'round';
}

export interface SpotlightCoachMarkProps {
  targetRect: TargetRect;
  title: string;
  subtitle?: string;
  /** "End tour", or Got it on the last step: every step counts as shown. */
  onDismiss: () => void;
  /** "Not now", a tap on the dim, Android back or escape: this tip only, back later. */
  onClose: () => void;
  /** Called when the user taps the highlighted target area */
  onTargetPress?: () => void;
  /** Current step index (0-based) for multi-step tutorials */
  stepIndex?: number;
  /** Total number of steps in the tutorial sequence */
  totalSteps?: number;
  /** When true, renders as an overlay View instead of a Modal so gestures
   *  pass through the hole area to the underlying content (e.g. swipeable items). */
  allowGesturePassthrough?: boolean;
  /** Next, and a left swipe on the dim. */
  onNext?: () => void;
  /** The step continues on the user's action, so it shows no Next. */
  waitsForAction?: boolean;
  /** A hand showing the gesture over the target. */
  demo?: 'swipe' | 'longPress';
}

/** The hole around a target: padded, and a circle for a round one. */
const holeAround = (rect: TargetRect, cornerRadius: number) => {
  if (rect.shape === 'round') {
    const size = Math.max(rect.width, rect.height) + HOLE_PADDING * 2;
    return {
      left: rect.x + rect.width / 2 - size / 2,
      top: rect.y + rect.height / 2 - size / 2,
      width: size,
      height: size,
      radius: size / 2,
    };
  }
  return {
    left: rect.x - HOLE_PADDING,
    top: rect.y - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
    radius: cornerRadius,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Dims the screen around a target and points a tip at it. The card sits beside
 * the target where it fits inside the safe area, else on the roomier side,
 * kept on screen. A tap on the dim, Android back and the screen reader's
 * escape are "Not now"; the hole travels between steps while it stays mounted.
 */
export const SpotlightCoachMark: React.FC<SpotlightCoachMarkProps> = ({
  targetRect,
  title,
  subtitle,
  onDismiss,
  onClose,
  onTargetPress,
  stepIndex,
  totalSteps,
  allowGesturePassthrough,
  onNext,
  waitsForAction,
  demo,
}) => {
  const { theme } = useUnistyles();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // In passthrough mode the overlay is a View inside the screen container,
  // not a full-screen Modal: page coordinates from measure() are converted to
  // the overlay's by its own page frame.
  const overlayRef = useRef<View>(null);
  const windowFrame = {
    x: 0,
    y: 0,
    width: window.width,
    height: window.height,
  };
  const [overlayFrame, setOverlayFrame] = useState<typeof windowFrame | null>(
    allowGesturePassthrough ? null : windowFrame,
  );

  // Re-measure when passthrough mode changes (adjusting state during render).
  const [prevPassthrough, setPrevPassthrough] = useState(
    allowGesturePassthrough,
  );
  if (prevPassthrough !== allowGesturePassthrough) {
    setPrevPassthrough(allowGesturePassthrough);
    setOverlayFrame(allowGesturePassthrough ? null : windowFrame);
  }

  const handleOverlayLayout = () => {
    if (!allowGesturePassthrough) return;
    requestAnimationFrame(() => {
      overlayRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        setOverlayFrame({ x: pageX, y: pageY, width, height });
      });
    });
  };

  const frame = allowGesturePassthrough
    ? overlayFrame ?? windowFrame
    : windowFrame;
  const adjustedRect: TargetRect = {
    ...targetRect,
    x: targetRect.x - frame.x,
    y: targetRect.y - frame.y,
  };

  const hole = holeAround(adjustedRect, theme.radii.md);
  const holeBottom = hole.top + hole.height;

  // ── Card placement, inside the safe area ──
  const gutter = theme.layout.pageGutter;
  const cardWidth = Math.min(frame.width - gutter * 2, TOOLTIP_MAX_WIDTH);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height !== cardHeight) setCardHeight(height);
  };
  const minTop = Math.max(0, insets.top - frame.y) + gutter;
  const maxBottom =
    Math.min(frame.height, window.height - insets.bottom - frame.y) - gutter;
  const gap = TOOLTIP_MARGIN + ARROW_SIZE;
  const height = cardHeight ?? 0;
  const roomBelow = maxBottom - (holeBottom + gap);
  const roomAbove = hole.top - gap - minTop;
  const below =
    height <= roomBelow || (height > roomAbove && roomBelow >= roomAbove);
  const preferredTop = below ? holeBottom + gap : hole.top - gap - height;
  const cardTop = clamp(preferredTop, minTop, maxBottom - height);
  // A card pushed off its target's side by the safe area points at nothing.
  const beside = cardTop === preferredTop;
  const centreX = adjustedRect.x + adjustedRect.width / 2;
  const cardLeft = clamp(
    centreX - cardWidth / 2,
    gutter,
    frame.width - cardWidth - gutter,
  );
  const arrowLeft = clamp(
    centreX - cardLeft - ARROW_SIZE / 2,
    theme.spacing.lg,
    cardWidth - ARROW_SIZE - theme.spacing.lg,
  );

  // ── Shared values ──
  const pulseOpacity = useSharedValue(1);
  const tooltipTranslateY = useSharedValue(
    adjustedRect.y > frame.height / 2 ? 10 : -10,
  );
  const tooltipOpacity = useSharedValue(0);
  const motionEnabled = useMotionEnabled();

  // Animated hole geometry for smooth step transitions
  const animHoleTop = useSharedValue(hole.top);
  const animHoleLeft = useSharedValue(hole.left);
  const animHoleWidth = useSharedValue(hole.width);
  const animHoleHeight = useSharedValue(hole.height);
  const animHoleRadius = useSharedValue(hole.radius);

  // Detect step changes — animate hole + cross-fade tooltip.
  // Uses "adjusting state during render" pattern (no effect needed).
  const [prevStepIndex, setPrevStepIndex] = useState(stepIndex);
  const [prevHole, setPrevHole] = useState(hole);

  const stepChanged = prevStepIndex !== stepIndex;
  const holeChanged =
    prevHole.left !== hole.left ||
    prevHole.top !== hole.top ||
    prevHole.width !== hole.width ||
    prevHole.height !== hole.height ||
    prevHole.radius !== hole.radius;

  if (stepChanged) {
    setPrevStepIndex(stepIndex);
    setPrevHole(hole);

    animHoleTop.set(withTiming(hole.top, HOLE_TIMING_CONFIG));
    animHoleLeft.set(withTiming(hole.left, HOLE_TIMING_CONFIG));
    animHoleWidth.set(withTiming(hole.width, HOLE_TIMING_CONFIG));
    animHoleHeight.set(withTiming(hole.height, HOLE_TIMING_CONFIG));
    animHoleRadius.set(withTiming(hole.radius, HOLE_TIMING_CONFIG));

    // Cross-fade tooltip (fade out → wait for hole to settle → fade in)
    tooltipOpacity.set(
      withSequence(
        withTiming(0, { duration: motion.timing.INSTANT }),
        withDelay(
          motion.timing.STANDARD,
          withTiming(1, { duration: motion.timing.FAST }),
        ),
      ),
    );
  } else if (holeChanged) {
    setPrevHole(hole);
    // The target moved without a step change (layout shift): snap.
    animHoleTop.set(hole.top);
    animHoleLeft.set(hole.left);
    animHoleWidth.set(hole.width);
    animHoleHeight.set(hole.height);
    animHoleRadius.set(hole.radius);
  }

  useLayoutEffect(() => {
    // Pulse ring — gentle opacity breathing (skipped when reduced motion is on)
    if (motionEnabled) {
      pulseOpacity.set(
        withDelay(
          motion.timing.STANDARD,
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
    }

    // Tooltip entry
    tooltipOpacity.set(
      withDelay(100, withTiming(1, { duration: motion.timing.STANDARD })),
    );
    tooltipTranslateY.set(withDelay(100, withSpring(0, motion.spring.GENTLE)));

    return () => {
      cancelAnimation(pulseOpacity);
      cancelAnimation(tooltipOpacity);
      cancelAnimation(tooltipTranslateY);
    };
  }, [pulseOpacity, tooltipTranslateY, tooltipOpacity, motionEnabled]);

  // ── Animated styles ──

  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.get(),
    transform: [{ translateY: tooltipTranslateY.get() }],
  }));

  // One Skia canvas draws the dim with its hole and the pulse ring, so the
  // animated geometry costs no layout pass per frame.
  const overlayColor = theme.colors.overlays.dark;
  const primaryColor = theme.colors.primary;

  const holePath = useDerivedValue(() =>
    Skia.PathBuilder.Make()
      .addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(
            animHoleLeft.get(),
            animHoleTop.get(),
            animHoleWidth.get(),
            animHoleHeight.get(),
          ),
          animHoleRadius.get(),
          animHoleRadius.get(),
        ),
      )
      .detach(),
  );

  // Swipe-to-advance gesture (left swipe → next step)
  // Pre-defined RN-scope callback for scheduleOnRN (CLAUDE.md convention)
  const handleSwipeAdvance = () => {
    onNext?.();
  };

  const swipeGesture = usePanGesture({
    activeOffsetX: [-20, 20],
    onDeactivate: event => {
      'worklet';
      if (event.translationX < -SWIPE_THRESHOLD) {
        scheduleOnRN(handleSwipeAdvance);
      }
    },
    enabled: !!onNext && !allowGesturePassthrough && !waitsForAction,
  });

  // On a gesture step the hole stays open to touch, so the dim is four strips
  // around it: a tap on any of them is still "Not now".
  const holeRight = hole.left + hole.width;
  const dimTaps = allowGesturePassthrough
    ? [
        { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) },
        { top: holeBottom, left: 0, right: 0, bottom: 0 },
        {
          top: hole.top,
          left: 0,
          width: Math.max(0, hole.left),
          height: hole.height,
        },
        { top: hole.top, left: holeRight, right: 0, height: hole.height },
      ]
    : [{ top: 0, left: 0, right: 0, bottom: 0 }];

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
        // On the Modal path only the tip is reachable until it closes.
        accessibilityViewIsModal={!allowGesturePassthrough}
      >
        {dimTaps.map((area, index) => (
          <Pressable
            key={index}
            style={[styles.dimTap, area]}
            onPress={onClose}
            accessible={false}
            testID={kitTestIDs.spotlightDim}
          />
        ))}

        <Canvas style={styles.fullScreen} pointerEvents="none">
          <Group clip={holePath} invertClip>
            <SkRect
              x={0}
              y={0}
              width={frame.width}
              height={frame.height}
              color={overlayColor}
            />
          </Group>
          <SkRoundedRect
            x={animHoleLeft}
            y={animHoleTop}
            width={animHoleWidth}
            height={animHoleHeight}
            r={animHoleRadius}
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
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: hole.radius,
              },
            ]}
            onPress={onTargetPress}
            accessibilityLabel={title}
            testID={kitTestIDs.spotlightTarget}
          />
        )}

        {demo ? (
          <GestureDemo key={stepIndex} kind={demo} rect={adjustedRect} />
        ) : null}

        <SpotlightTooltip
          containerStyle={[
            { left: cardLeft, top: cardTop, width: cardWidth },
            cardHeight === null && styles.unmeasured,
          ]}
          arrowStyle={
            beside
              ? {
                  left: arrowLeft,
                  ...(below
                    ? { top: -ARROW_SIZE / 2 }
                    : { bottom: -ARROW_SIZE / 2 }),
                }
              : null
          }
          animatedStyle={tooltipAnimatedStyle}
          onLayout={handleCardLayout}
          title={title}
          subtitle={subtitle}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          waitsForAction={waitsForAction}
          announce={allowGesturePassthrough}
          onDismiss={onDismiss}
          onClose={onClose}
          onNext={onNext}
        />
      </View>
    </GestureDetector>
  );

  // Refuse to render with a degenerate target rect. Tutorial state machines
  // can advance to a spotlight step before the target view has committed
  // its layout — at that moment the rect is 0×0. The Canvas would then
  // draw a full-screen dim with NO hole and the tooltip would be positioned
  // at (0, 0) (off-screen / invisible), producing a "stuck dim" with no
  // dismiss UI. Returning null until the rect is real avoids it.
  if (targetRect.width <= 0 || targetRect.height <= 0) return null;

  if (allowGesturePassthrough) {
    // Wait for the overlay to measure its page offset before showing content
    // to avoid a single-frame flash at the wrong position
    if (overlayFrame === null) {
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
      onRequestClose={onClose}
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
    zIndex: theme.zIndex.overlay,
  },
  passthroughMeasure: {
    ...StyleSheet.absoluteFillObject,
    zIndex: theme.zIndex.overlay,
  },
  dimTap: {
    position: 'absolute',
  },
  holeTap: {
    position: 'absolute',
  },
  // Placed once its height is known, so it never shows at a guess.
  unmeasured: {
    opacity: 0,
  },
}));
