import { useRef, ComponentRef } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRecyclingState } from '@shopify/flash-list';

interface UseSwipeableActionsProps {
  /** Item ID for FlashList recycling reset */
  itemId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  enableSwipeToDelete?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

export const useSwipeableActions = ({
  itemId,
  onEdit,
  onDelete,
  onSwipeableWillOpen,
  onSwipeableClose,
}: UseSwipeableActionsProps) => {
  const swipeableRef = useRef<ComponentRef<typeof Swipeable>>(null);

  // Synchronous reset on cell recycling — fires during render (before paint)
  useRecyclingState(undefined, [itemId], () => {
    swipeableRef.current?.close();
  });

  const handleActionPress = (action: 'edit' | 'delete') => {
    swipeableRef.current?.close();

    if (action === 'edit') {
      onEdit?.();
    } else if (action === 'delete') {
      onDelete?.();
    }
  };

  const handleSwipeableWillOpen = () => {
    // Notify parent that this swipeable is about to open
    // This allows parent to close any previously open swipeable
    onSwipeableWillOpen?.(swipeableRef);
  };

  const handleSwipeableClose = () => {
    // Notify parent that this swipeable has closed
    onSwipeableClose?.();
  };

  return {
    swipeableRef,
    handleActionPress,
    handleSwipeableWillOpen,
    handleSwipeableClose,
  };
};
