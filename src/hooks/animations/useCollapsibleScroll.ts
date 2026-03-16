import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type {
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
} from 'react-native';

/**
 * Distance (px) over which the header fully collapses.
 * Tuned so collapse feels smooth but not sluggish.
 */
const COLLAPSE_DISTANCE = 120;

/**
 * Minimum scroll delta to register a direction change.
 * Prevents jitter from tiny touch movements.
 */
const DIRECTION_THRESHOLD = 10;

interface UseCollapsibleScrollConfig {
  /** Measured height of the collapsible header zone (from onLayout). */
  headerHeight: number;
}

export interface UseCollapsibleScrollReturn {
  /** Attach to FlashList onScroll (regular JS callback, compatible with FlashList v2). */
  scrollHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Apply to the inner Animated.View (translateY + opacity). */
  collapsibleStyle: ViewStyle;
  /** Apply to the outer Animated.View (animated height + overflow). */
  collapsibleHeightStyle: ViewStyle;
  /** true when scrolling down past the collapse zone — drive tab bar hide. */
  isScrolledDown: SharedValue<boolean>;
  /** Current scroll offset (useful for external consumers). */
  scrollY: SharedValue<number>;
}

/**
 * Scroll-driven collapsible header + direction-based tab bar hide.
 *
 * Uses a regular JS onScroll callback (FlashList v2 compatible) that writes
 * to SharedValues via .set(). Animated styles still run on the UI thread.
 */
export function useCollapsibleScroll({
  headerHeight,
}: UseCollapsibleScrollConfig): UseCollapsibleScrollReturn {
  const scrollY = useSharedValue(0);
  const prevScrollY = useSharedValue(0);
  const isScrolledDown = useSharedValue(false);

  // Regular JS callback — FlashList v2 invokes onScroll as a plain function.
  // SharedValue.set() bridges JS → UI thread for the animated styles.
  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableOverflow = contentSize.height - layoutMeasurement.height;

    // Don't collapse if content isn't tall enough (short list / empty state).
    // Prevents jitter feedback loop: collapse → reclaim space → bounce → expand → repeat.
    if (scrollableOverflow < COLLAPSE_DISTANCE) {
      if (scrollY.value > 0) scrollY.set(0);
      if (isScrolledDown.value) isScrolledDown.set(false);
      return;
    }

    // Clamp at 0 — negative values are pull-to-refresh bounce
    const y = Math.max(0, contentOffset.y);
    const delta = y - prevScrollY.value;

    // Header collapse: position-based
    scrollY.set(y);

    // Tab bar: direction-based with threshold.
    // Single .set() per event to minimize JS→UI bridge calls.
    if (Math.abs(delta) > DIRECTION_THRESHOLD) {
      isScrolledDown.set(delta > 0 && y > COLLAPSE_DISTANCE);
      prevScrollY.set(y);
    } else if (y <= COLLAPSE_DISTANCE && isScrolledDown.value) {
      // Near top with no significant delta — ensure tab bar is visible
      isScrolledDown.set(false);
    }
  };

  const collapsibleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [0, -COLLAPSE_DISTANCE],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }], opacity };
  });

  const collapsibleHeightStyle = useAnimatedStyle(() => {
    // Don't constrain height until measured — content flows at natural size
    if (headerHeight === 0) return {};
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [headerHeight, 0],
      Extrapolation.CLAMP,
    );
    return { height, overflow: 'hidden' };
  });

  return {
    scrollHandler,
    collapsibleStyle,
    collapsibleHeightStyle,
    isScrolledDown,
    scrollY,
  };
}
