import { useRef, ComponentRef } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

interface UseSwipeableActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  animateDelete: () => void;
  enableSwipeToDelete?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

export const useSwipeableActions = ({
  onEdit,
  onDelete,
  animateDelete,
  onSwipeableWillOpen,
  onSwipeableClose,
}: UseSwipeableActionsProps) => {
  const swipeableRef = useRef<ComponentRef<typeof Swipeable>>(null);

  const handleActionPress = (action: 'edit' | 'delete') => {
    swipeableRef.current?.close();

    if (action === 'edit') {
      onEdit?.();
    } else if (action === 'delete') {
      // Start fade animation and trigger delete in parallel
      animateDelete();
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
