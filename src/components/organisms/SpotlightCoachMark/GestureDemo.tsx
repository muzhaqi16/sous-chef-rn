import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { kitTestIDs } from '#components/testIDs';
import { DEMO_PERIOD_MS, DEMO_REPEATS } from './spotlightConstants';

/** How far the hand travels, as a share of the row's width. */
const SWIPE_TRAVEL = 0.3;

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
  const motionEnabled = useMotionEnabled();
  const progress = useSharedValue(0);
  const travel = rect.width * SWIPE_TRAVEL;

  useEffect(() => {
    if (!motionEnabled) return;
    progress.set(0);
    progress.set(
      withRepeat(
        withTiming(1, { duration: DEMO_PERIOD_MS, easing: Easing.linear }),
        DEMO_REPEATS,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [motionEnabled, progress, kind]);

  // Each showing: appear, act, hold, fade. A finished demo rests faded out.
  const handStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const opacity = interpolate(p, [0, 0.1, 0.75, 0.9, 1], [0, 1, 1, 0, 0]);
    if (kind === 'swipe') {
      return {
        opacity,
        transform: [
          {
            translateX: interpolate(
              p,
              [0, 0.15, 0.65, 1],
              [travel / 2, travel / 2, -travel / 2, -travel / 2],
            ),
          },
        ],
      };
    }
    return {
      opacity,
      transform: [
        {
          scale: interpolate(p, [0, 0.2, 0.3, 0.7, 0.8], [1, 1, 0.85, 0.85, 1]),
        },
      ],
    };
  });

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
        <Animated.View style={[handFrame.hand, handStyle]}>
          <HandMark />
        </Animated.View>
      ) : (
        <View style={styles.still}>
          {kind === 'swipe' ? (
            <Icon name="chevron-back" size={20} tone="onPrimary" />
          ) : null}
          <HandMark />
          {kind === 'swipe' ? (
            <Icon name="chevron-forward" size={20} tone="onPrimary" />
          ) : null}
        </View>
      )}
    </View>
  );
};

const HandMark = () => (
  <View style={styles.disc}>
    <Icon name="hand-left" size={28} tone="onPrimary" />
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
