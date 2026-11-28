import React from 'react';
import { View } from 'react-native';
import Animated, {
  css,
  type CSSAnimationProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { kitTestIDs } from '#components/testIDs';
import { DEMO_PERIOD_MS, DEMO_REPEATS } from './spotlightConstants';

/** How far the hand travels, as a share of the row's width. */
const SWIPE_TRAVEL = 0.3;

/**
 * Each showing: appear, act, hold, fade, `DEMO_REPEATS` times, then rest faded
 * out. `travel` is the swipe's length; a long press presses and lets go.
 */
const demo = (
  kind: GestureDemoProps['kind'],
  travel: number,
): CSSAnimationProperties => ({
  animationName:
    kind === 'swipe'
      ? css.keyframes({
          '0%': { opacity: 0, transform: [{ translateX: travel / 2 }] },
          '10%': { opacity: 1 },
          '15%': { transform: [{ translateX: travel / 2 }] },
          '65%': { transform: [{ translateX: -travel / 2 }] },
          '75%': { opacity: 1 },
          '90%': { opacity: 0 },
          '100%': { opacity: 0, transform: [{ translateX: -travel / 2 }] },
        })
      : css.keyframes({
          '0%': { opacity: 0, transform: [{ scale: 1 }] },
          '10%': { opacity: 1 },
          '20%': { transform: [{ scale: 1 }] },
          '30%': { transform: [{ scale: 0.85 }] },
          '70%': { transform: [{ scale: 0.85 }] },
          '75%': { opacity: 1 },
          '80%': { transform: [{ scale: 1 }] },
          '90%': { opacity: 0 },
          '100%': { opacity: 0, transform: [{ scale: 1 }] },
        }),
  animationDuration: DEMO_PERIOD_MS,
  animationIterationCount: DEMO_REPEATS,
  animationTimingFunction: 'linear',
  animationFillMode: 'forwards',
});

interface GestureDemoProps {
  kind: 'swipe' | 'longPress';
  /** The highlighted row, in the overlay's coordinates. */
  rect: { x: number; y: number; width: number; height: number };
}

/**
 * A hand showing a gesture over the highlighted row, a few times, then gone.
 * It moves nothing but itself. With Reduce Motion on it stands still, with
 * arrows for a swipe.
 */
export const GestureDemo = ({ kind, rect }: GestureDemoProps) => {
  // Reanimated's CSS animations ignore reduce motion, so a still hand stands in.
  const motionEnabled = useMotionEnabled();
  const travel = rect.width * SWIPE_TRAVEL;

  const centre = {
    left: rect.x + rect.width / 2,
    top: rect.y + rect.height / 2,
  };

  return (
    <View
      pointerEvents="none"
      style={[styles.anchor, centre]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={kitTestIDs.spotlightGestureDemo}
    >
      {motionEnabled ? (
        <Animated.View style={[handFrame.hand, demo(kind, travel)]}>
          <HandMark />
        </Animated.View>
      ) : (
        <View style={styles.still}>
          {kind === 'swipe' ? (
            <Icon name="chevron-back" size="sm" tone="onPrimary" />
          ) : null}
          <HandMark />
          {kind === 'swipe' ? (
            <Icon name="chevron-forward" size="sm" tone="onPrimary" />
          ) : null}
        </View>
      )}
    </View>
  );
};

const HandMark = () => (
  <View style={styles.disc}>
    <Icon name="hand-left" size="md" tone="onPrimary" />
  </View>
);

// Not themed: Reanimated animates this node.
const HAND_SIZE = 48;
const handFrame = StyleSheet.create({
  hand: {
    width: HAND_SIZE,
    height: HAND_SIZE,
  },
});

const styles = StyleSheet.create(theme => ({
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  disc: {
    width: HAND_SIZE,
    height: HAND_SIZE,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  still: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
}));
