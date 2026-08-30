import { useRef, ComponentRef } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRecyclingState } from '@shopify/flash-list';

type SwipeableRef = React.RefObject<ComponentRef<typeof Swipeable> | null>;

interface UseSwipeableActionsProps {
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

  // useRecyclingState resets `hasSwipeStarted` on cell recycle via a ref write, and
  // onReset closes any open swipeable synchronously before paint.
  const [hasSwipeStarted, setHasSwipeStarted] = useRecyclingState(
    false,
    [itemId],
    () => {
      swipeableRef.current?.close();
    },
  );

  const handleSwipeableWillOpen = () => {
    onSwipeableWillOpen?.(swipeableRef);
  };

  const handleSwipeableClose = () => {
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
