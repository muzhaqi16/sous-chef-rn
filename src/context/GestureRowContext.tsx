import { createValueContext } from '#hooks/utils/createValueContext';

const GestureRow = createValueContext<true>('GestureRow');

/** Set by a row RNGH's Swipeable moves, around its press surface and controls. */
export const GestureRowProvider = GestureRow.Provider;

/**
 * True inside a swipe row. A control there presses through RNGH's Pressable:
 * an RN one under an RNGH gesture takes the touch, so a swipe that starts on it
 * never moves the row.
 */
export const useInGestureRow = (): boolean =>
  GestureRow.useOptionalValue() === true;
