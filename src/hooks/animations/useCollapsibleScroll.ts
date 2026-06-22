import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

/**
 * Distance (px) past which scrolling-down hides the tab bar.
 */
const COLLAPSE_DISTANCE = 120;

/**
 * Minimum scroll delta to register a direction change.
 * Prevents jitter from tiny touch movements.
 */
const DIRECTION_THRESHOLD = 10;

export interface UseCollapsibleScrollReturn {
  /** Attach to FlashList onScrollBeginDrag — marks the scroll as finger-driven. */
  scrollBeginDragHandler: () => void;
  /** Attach to FlashList onScroll (regular JS callback, compatible with FlashList v2). */
  scrollHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Attach to FlashList onScrollEndDrag — shows tab bar when drag ends without momentum. */
  scrollEndDragHandler: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  /** Attach to FlashList onMomentumScrollEnd — shows tab bar when momentum ends. */
  momentumEndHandler: () => void;
  /** true when scrolling down past the threshold — drive tab bar hide. */
  isScrolledDown: SharedValue<boolean>;
  /**
   * true while a finger is driving the scroll. Exposed so screens can clear it
   * on focus/blur — a fling interrupted by a tab switch would otherwise leave
   * it stuck, letting a later programmatic scroll hide the bar.
   */
  isUserDragging: SharedValue<boolean>;
  /** Current scroll offset. */
  scrollY: SharedValue<number>;
}

/**
 * Direction-based tab bar hide on scroll.
 *
 * Stripped-down version: no animated height/collapse styles. The collapsible
 * header is handled by the FlashList's native scroll + stickyHeaderIndices.
 * This hook only tracks scroll direction to drive tab bar visibility.
 */
export function useCollapsibleScroll(): UseCollapsibleScrollReturn {
  const scrollY = useSharedValue(0);
  const prevScrollY = useSharedValue(0);
  const isScrolledDown = useSharedValue(false);
  // True only while a finger is driving the scroll — set on onScrollBeginDrag
  // and cleared when the scroll comes to rest. Programmatic and layout scrolls
  // (FlashList's maintainVisibleContentPosition after a focus refetch, lazy
  // mounts, scrollToOffset, and background tabs under inactiveBehavior:'none')
  // fire onScroll WITHOUT a preceding onScrollBeginDrag, so this stays false
  // for them and they can never hide the tab bar. Those non-user scrolls during
  // a tab switch were what made the bar flicker hidden then visible.
  const isUserDragging = useSharedValue(false);

  const scrollBeginDragHandler = () => {
    isUserDragging.set(true);
  };

  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - prevScrollY.get();

    scrollY.set(y);

    if (Math.abs(delta) > DIRECTION_THRESHOLD) {
      // Only a finger-driven scroll may hide the bar; programmatic/layout
      // scrolls update the tracked offset but leave the bar untouched.
      if (isUserDragging.get()) {
        isScrolledDown.set(delta > 0 && y > COLLAPSE_DISTANCE);
      }
      prevScrollY.set(y);
    } else if (y <= COLLAPSE_DISTANCE && isScrolledDown.get()) {
      // Returning near the top always reveals the bar, whatever the source.
      isScrolledDown.set(false);
    }
  };

  const scrollEndDragHandler = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    // If velocity is near zero, no momentum will follow — the gesture is over,
    // so the drag ends and the tab bar is shown.
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) < 0.5) {
      isUserDragging.set(false);
      isScrolledDown.set(false);
    }
  };

  const momentumEndHandler = () => {
    isUserDragging.set(false);
    isScrolledDown.set(false);
  };

  return {
    scrollBeginDragHandler,
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
    isUserDragging,
    scrollY,
  };
}
