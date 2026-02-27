import { useRef } from 'react';

/**
 * Hook to coordinate swipeable items, ensuring only one is open at a time
 *
 * Useful for lists with swipeable actions (delete, edit, etc.) where
 * you want to automatically close the previously opened item when a
 * new one is opened.
 *
 * @returns Object with handleSwipeableWillOpen and handleSwipeableClose callbacks
 *
 * @example
 * ```typescript
 * const { handleSwipeableWillOpen } = useSwipeableCoordinator();
 *
 * <SwipeableList
 *   items={items}
 *   onSwipeableWillOpen={handleSwipeableWillOpen}
 * />
 * ```
 */
export function useSwipeableCoordinator() {
  const openSwipeableRef = useRef<any>(null);

  /**
   * Handler to be called when a swipeable item is about to open
   *
   * Automatically closes the previously open swipeable if a different
   * item is being opened.
   *
   * @param ref - Reference to the swipeable component being opened
   */
  const handleSwipeableWillOpen = (ref: any) => {
    // If there's a currently open swipeable and it's different from the new one
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      // Close the previously open swipeable
      openSwipeableRef.current.current?.close();
    }

    // Update to track the newly opening swipeable
    openSwipeableRef.current = ref;
  };

  /**
   * Handler to be called when a swipeable item closes
   *
   * Clears the reference to the open swipeable.
   */
  const handleSwipeableClose = () => {
    openSwipeableRef.current = null;
  };

  return {
    handleSwipeableWillOpen,
    handleSwipeableClose };
}
