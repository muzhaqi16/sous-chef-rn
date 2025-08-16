import {useRef, ComponentRef} from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

interface UseSwipeableActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  animateDelete: () => void;
  enableSwipeToDelete?: boolean;
}

export const useSwipeableActions = ({
  onEdit,
  onDelete,
  animateDelete,
  enableSwipeToDelete = true,
}: UseSwipeableActionsProps) => {
  const swipeableRef = useRef<ComponentRef<typeof ReanimatedSwipeable>>(null);

  const handleActionPress = (action: 'edit' | 'delete') => {
    swipeableRef.current?.close();

    if (action === 'edit') {
      onEdit?.();
    } else if (action === 'delete') {
      onDelete?.();
    }
  };

  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left' && enableSwipeToDelete && onDelete) {
      animateDelete();
    }
  };

  return {
    swipeableRef,
    handleActionPress,
    handleSwipeableOpen,
  };
};
