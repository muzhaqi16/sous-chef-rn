import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

/**
 * Offset past which scrolling down may hide the tab bar.
 */
const COLLAPSE_DISTANCE = 120;

/**
 * Offset below which the bar is always revealed, whatever moved the list. Held
 * clear of COLLAPSE_DISTANCE so the hide gate and the reveal gate are separate
 * boundaries — a single shared threshold chatters when the offset sits on it.
 */
const REVEAL_DISTANCE = 72;

/**
 * Travel (px) a direction must accumulate before the bar follows it. A finger
 * makes constant sub-50px corrections mid-scroll, so a per-event direction read
 * flips the bar several times a second; the bar tracks sustained travel instead.
 */
const DIRECTION_TRAVEL = 48;

/**
 * Per-event delta small enough to be touch noise rather than a direction.
 */
const DIRECTION_THRESHOLD = 4;

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
 *
 * Direction is hysteretic: the bar changes state only once one direction has
 * travelled DIRECTION_TRAVEL, so an unsustained reversal cannot toggle it.
 */
export function useCollapsibleScroll(): UseCollapsibleScrollReturn {
  const scrollY = useSharedValue(0);
  const prevScrollY = useSharedValue(0);
  const isScrolledDown = useSharedValue(false);
  /** Offset the current direction run started from; travel is measured from it. */
  const travelAnchor = useSharedValue(0);
  /** Sign of the current direction run: 1 down, -1 up, 0 unset. */
  const travelDirection = useSharedValue(0);
  // True only while a finger is driving the scroll — set on onScrollBeginDrag
  // and cleared when the scroll comes to rest. Programmatic and layout scrolls
  // (FlashList's maintainVisibleContentPosition after a focus refetch, lazy
  // mounts, and scrollToOffset — including when a paused tab resumes and
  // re-runs its focus refetch) fire onScroll WITHOUT a preceding
  // onScrollBeginDrag, so this stays false for them and they can never hide the
  // tab bar.
  const isUserDragging = useSharedValue(false);

  const scrollBeginDragHandler = () => {
    isUserDragging.set(true);
    // Measure this gesture's travel from where it began, not from a run left by
    // the previous gesture or by a focus reset.
    travelAnchor.set(scrollY.get());
    travelDirection.set(0);
  };

  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const previous = prevScrollY.get();
    const delta = y - previous;

    scrollY.set(y);
    // Advanced on every event: gating this on the threshold leaves the anchor
    // stale through a slow scroll, so deltas measure against an old offset.
    prevScrollY.set(y);

    // Near the top the bar is always revealed, whatever moved the list.
    if (y <= REVEAL_DISTANCE) {
      travelAnchor.set(y);
      travelDirection.set(0);
      if (isScrolledDown.get()) {
        isScrolledDown.set(false);
      }
      return;
    }

    if (Math.abs(delta) <= DIRECTION_THRESHOLD) {
      return;
    }

    const direction = delta > 0 ? 1 : -1;
    if (direction !== travelDirection.get()) {
      // A reversal restarts the run from where the previous one ended, so the
      // bar follows only if the new direction is sustained.
      travelDirection.set(direction);
      travelAnchor.set(previous);
    }

    // Only a finger-driven scroll may move the bar; programmatic and layout
    // scrolls keep the tracking current but leave it alone.
    if (!isUserDragging.get()) {
      return;
    }

    if (Math.abs(y - travelAnchor.get()) < DIRECTION_TRAVEL) {
      return;
    }

    isScrolledDown.set(direction > 0 && y > COLLAPSE_DISTANCE);
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
