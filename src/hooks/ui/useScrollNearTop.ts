import { useState } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Pixel threshold below which scrollY is considered "near top". */
const DEFAULT_THRESHOLD = 10;

/**
 * Returns `true` when `scrollY` is at or near the top of the list.
 *
 * Uses `useAnimatedReaction` so the callback fires only on boolean
 * transitions (not on every scroll tick), and `scheduleOnRN` to bridge
 * the result to React state.
 */
export function useScrollNearTop(
  scrollY: SharedValue<number>,
  threshold = DEFAULT_THRESHOLD,
): boolean {
  const [isNearTop, setIsNearTop] = useState(true);

  // Pre-defined RN-scope callbacks for scheduleOnRN (CLAUDE.md convention)
  const setNearTopTrue = () => setIsNearTop(true);
  const setNearTopFalse = () => setIsNearTop(false);

  useAnimatedReaction(
    () => scrollY.value <= threshold,
    (nearTop, prevNearTop) => {
      'worklet';
      if (nearTop === prevNearTop) return;
      if (nearTop) {
        scheduleOnRN(setNearTopTrue);
      } else {
        scheduleOnRN(setNearTopFalse);
      }
    },
  );

  return isNearTop;
}
