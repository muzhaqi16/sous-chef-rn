import { useRef, ComponentRef } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRecyclingState } from '@shopify/flash-list';

type SwipeableRef = React.RefObject<ComponentRef<typeof Swipeable> | null>;

interface UseSwipeableActionsProps {
  /** Item ID for FlashList recycling reset */
  itemId?: string;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
}

export const useSwipeableActions = ({
  itemId,
  onSwipeableWillOpen,
  onSwipeableClose,
}: UseSwipeableActionsProps) => {
  const swipeableRef = useRef<ComponentRef<typeof Swipeable>>(null);

  // useRecyclingState resets hasSwipeStarted to `false` via internal ref write
  // on cell recycling (no setState during render). The onReset callback closes
  // any open swipeable synchronously before paint.
  const [hasSwipeStarted, setHasSwipeStarted] = useRecyclingState(
    false,
    [itemId],
    () => {
      swipeableRef.current?.close();
    },
  );

  const handleSwipeableWillOpen = () => {
    // Notify parent that this swipeable is about to open
    // This allows parent to close any previously open swipeable
    onSwipeableWillOpen?.(swipeableRef);
  };

  const handleSwipeableClose = () => {
    // Notify parent that this swipeable has closed
    onSwipeableClose?.();
    setHasSwipeStarted(false);
  };

  const handleSwipeOpenStartDrag = () => {
    setHasSwipeStarted(true);
  };

  return {
    swipeableRef,
    handleSwipeableWillOpen,
    handleSwipeableClose,
    hasSwipeStarted,
    handleSwipeOpenStartDrag,
  };
};
