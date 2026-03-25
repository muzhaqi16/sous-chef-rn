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

  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - prevScrollY.get();

    scrollY.set(y);

    if (Math.abs(delta) > DIRECTION_THRESHOLD) {
      isScrolledDown.set(delta > 0 && y > COLLAPSE_DISTANCE);
      prevScrollY.set(y);
    } else if (y <= COLLAPSE_DISTANCE && isScrolledDown.get()) {
      isScrolledDown.set(false);
    }
  };

  const scrollEndDragHandler = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    // If velocity is near zero, no momentum will follow — show tab bar now
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) < 0.5) {
      isScrolledDown.set(false);
    }
  };

  const momentumEndHandler = () => {
    isScrolledDown.set(false);
  };

  return {
    scrollHandler,
    scrollEndDragHandler,
    momentumEndHandler,
    isScrolledDown,
    scrollY,
  };
}
