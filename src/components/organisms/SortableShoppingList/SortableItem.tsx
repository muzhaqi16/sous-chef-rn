import React, { useCallback } from 'react';
import { Vibration, Platform, View, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { DragHandle } from '#/components/atoms/DragHandle';
import { commonStyles } from '#/styles';
import { HapticService } from '#services/haptic';
import { ShoppingListItemCounter } from '#/components/molecules/ShoppingListItemCounter';
import { useShoppingListActions } from '#context/ShoppingListActionsContext';
import type { CounterElementConfig, ImageElementConfig } from './types';

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
    rightElementConfig?: CounterElementConfig; // Config-based element creation
    leftElement?: React.ReactNode;
    leftElementConfig?: ImageElementConfig; // Config-based element creation
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
  // Get stable callbacks from context (prevents memoization breaking)
  const { onIncrementQuantity, onDecrementQuantity } = useShoppingListActions();

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

  // Create rightElement from config or use provided element
  // OPTIMIZATION: Minimal dependencies - callbacks from context are stable
  const rightElement = React.useMemo(() => {
    // Priority 1: Use config-based element (performance optimized)
    if (item.rightElementConfig?.type === 'counter') {
      const config = item.rightElementConfig;
      const dragHandle = !item.isPurchased && drag ? (
        <DragHandle
          onLongPress={handleLongPress}
          disabled={item.isPurchased}
        />
      ) : undefined;

      return (
        <ShoppingListItemCounter
          quantity={config.quantity}
          unit={config.unit}
          onIncrement={() => onIncrementQuantity(config.itemId)}
          onDecrement={() => onDecrementQuantity(config.itemId)}
          disabled={config.disabled}
          rightElement={dragHandle}
        />
      );
    }

    // Priority 2: Use provided element with drag handle injection
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
  }, [
    drag,
    item.isPurchased,
    item.rightElement,
    item.rightElementConfig,
    handleLongPress,
    onIncrementQuantity,
    onDecrementQuantity,
  ]);

  // Create leftElement from config or use provided element
  const leftElement = React.useMemo(() => {
    // Priority 1: Use config-based element (performance optimized)
    if (item.leftElementConfig?.type === 'image') {
      const config = item.leftElementConfig;
      return (
        <View
          style={[
            commonStyles.listItemImageContainer,
            config.isPurchased && { opacity: 0.5 },
          ]}
        >
          <Image
            source={{ uri: config.url }}
            style={commonStyles.listItemImage}
          />
        </View>
      );
    }

    // Priority 2: Use provided element
    return item.leftElement;
  }, [item.leftElement, item.leftElementConfig]);

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
          leftElement={leftElement}
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

// Custom comparison function for React.memo to prevent unnecessary re-renders
// Only re-render if critical props change
const arePropsEqual = (
  prev: SimpleDraggableItemProps,
  next: SimpleDraggableItemProps,
): boolean => {
  // Check if item identity or key properties changed
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.isPurchased !== next.item.isPurchased) return false;
  if (prev.item.title !== next.item.title) return false;

  // Check quantity in config (most common update)
  if (prev.item.rightElementConfig?.quantity !== next.item.rightElementConfig?.quantity) {
    return false;
  }

  // Check image URL in config
  if (prev.item.leftElementConfig?.url !== next.item.leftElementConfig?.url) {
    return false;
  }

  // Check disabled state
  if (prev.item.rightElementConfig?.disabled !== next.item.rightElementConfig?.disabled) {
    return false;
  }

  // Check drag state
  if (prev.drag !== next.drag) return false;
  if (prev.isActive !== next.isActive) return false;

  // All critical props are equal - skip re-render
  return true;
};

// Memoize component to prevent unnecessary re-renders during drag operations
export const SimpleDraggableItem = React.memo(SimpleDraggableItemComponent, arePropsEqual);
