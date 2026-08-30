import { useRef } from 'react';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

/** Ref to a RNGH Swipeable's imperative methods (passed by the list rows). */
type SwipeableRef = React.RefObject<SwipeableMethods | null>;

/** Keeps at most one swipeable row open, closing the previous one. */
export function useSwipeableCoordinator() {
  const openSwipeableRef = useRef<SwipeableRef | null>(null);

  const handleSwipeableWillOpen = (ref: SwipeableRef) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.current?.close();
    }

    openSwipeableRef.current = ref;
  };

  /**
   * Deliberately does NOT clear the ref — `onSwipeableClose` fires
   * asynchronously after the close animation, so clearing here races: open B,
   * close A, then A's late callback wipes B's ref.
   */
  const handleSwipeableClose = () => {
    // no-op — handleSwipeableWillOpen exclusively manages the ref
  };

  /** Close the open swipeable and clear the ref (tab change, "close all"). */
  const closeAll = () => {
    openSwipeableRef.current?.current?.close();
    openSwipeableRef.current = null;
  };

  return {
    handleSwipeableWillOpen,
    handleSwipeableClose,
    closeAll,
  };
}
