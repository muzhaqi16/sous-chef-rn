import React, { useCallback } from 'react';
import { Vibration, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { DragHandle } from '#/components/atoms/DragHandle';
import { commonStyles } from '#/styles';
import { HapticService } from '#services/haptic';

interface SimpleDraggableItemProps {
  item: {
    id: string;
    title: string;
    subtitle: string | React.ReactNode;
    isPurchased?: boolean;
    badge?: {
      text: string;
      variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    };
    rightElement?: React.ReactNode;
    leftElement?: React.ReactNode;
  };
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  drag?: () => void;
  isActive?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

const SimpleDraggableItemComponent: React.FC<SimpleDraggableItemProps> = ({
  item,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  drag,
  isActive,
  onSwipeableWillOpen,
  onSwipeableClose,
}) => {
  // Handle long press for drag activation with haptic feedback
  const handleLongPress = useCallback(() => {
    if (drag) {
      // Provide haptic feedback when drag activates
      HapticService.longPress();
      drag();
    }
  }, [drag]);

  // Handle long press for purchase toggle (when drag handle is not available)
  const handleToggleLongPress = useCallback(() => {
    if (onTogglePurchase) {
      // Provide haptic feedback for toggle action
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 50]); // Short vibration for toggle
      } else {
        Vibration.vibrate(50);
      }
      onTogglePurchase(item.id);
    }
  }, [onTogglePurchase, item.id]);

  // Clone rightElement if it's ShoppingListItemCounter and inject drag handle
  const rightElement = React.useMemo(() => {
    if (!drag || item.isPurchased) {
      return item.rightElement;
    }

    // Clone the counter element and inject drag handle
    if (React.isValidElement(item.rightElement)) {
      return React.cloneElement(item.rightElement as React.ReactElement<any>, {
        rightElement: (
          <DragHandle
            onLongPress={handleLongPress}
            disabled={item.isPurchased}
          />
        ),
      });
    }

    return item.rightElement;
  }, [drag, item.isPurchased, item.rightElement, handleLongPress]);

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <SwipeableItem
        onPress={() => onItemPress(item.id)}
        onLongPress={
          !drag && onTogglePurchase ? handleToggleLongPress : undefined
        }
        onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
        onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
        onTogglePurchase={
          onTogglePurchase ? () => onTogglePurchase(item.id) : undefined
        }
        isPurchased={item.isPurchased}
        friction={1}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
      >
        <ListItem
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          rightElement={rightElement}
          leftElement={item.leftElement}
          rightIcon={undefined}
          isPurchased={item.isPurchased}
        />
      </SwipeableItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    ...commonStyles.shadow,
    opacity: 1,
    // Horizontal margin for shadow visibility
    marginHorizontal: theme.spacing.sm,
    // Vertical margin for consistent spacing between items
    marginVertical: theme.spacing.sm,
    borderRadius: 12,
  },
  activeContainer: {
    opacity: 0.98,
    // Enhanced shadow when dragging for visual feedback
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}));

// Memoize component to prevent unnecessary re-renders during drag operations
export const SimpleDraggableItem = React.memo(SimpleDraggableItemComponent);
