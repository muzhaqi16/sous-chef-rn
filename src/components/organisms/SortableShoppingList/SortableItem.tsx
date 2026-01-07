import React, { useCallback } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated from 'react-native-reanimated';
import { useItemExitAnimation } from '#/hooks/animations';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { DragHandle } from '#/components/atoms/DragHandle';
import { AnimatedCheckbox } from '#/components/atoms/AnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { commonStyles } from '#/styles';
import { HapticService } from '#services/haptic';
import { Icon } from '#utils';
import type { QuantityElementConfig, ImageElementConfig } from './types';
import { useSortableListActions } from './SortableListActionsContext';

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
    rightElementConfig?: QuantityElementConfig; // Config-based element creation
    leftElement?: React.ReactNode;
    leftElementConfig?: ImageElementConfig; // Config-based element creation
  };
  drag?: () => void;
  isActive?: boolean;
}

const SimpleDraggableItemComponent: React.FC<SimpleDraggableItemProps> = ({
  item,
  drag,
  isActive,
}) => {
  const { theme } = useUnistyles();

  // Get actions and permissions from context (stable references)
  const { actions, permissionsRef } = useSortableListActions();
  const {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSwipeableWillOpen,
    onSwipeableClose,
  } = actions;
  // Read permissions from ref to always get latest values
  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissionsRef.current;

  // ANIMATION: Exit animation using reusable hook
  const { exitAnimatedStyle, triggerExit } = useItemExitAnimation();

  // Handle long press for drag activation with haptic feedback
  const handleLongPress = useCallback(() => {
    if (drag) {
      // Provide haptic feedback when drag activates
      HapticService.longPress();
      drag();
    }
  }, [drag]);

  // Create rightElement from config or use provided element
  // Uses QuantityBadge (tappable) + DragHandle or MoveToPantry button
  const rightElement = React.useMemo(() => {
    // Priority 1: Use config-based element (performance optimized)
    if (item.rightElementConfig?.type === 'quantity') {
      const config = item.rightElementConfig;

      return (
        <View style={styles.rightElementContainer}>
          {/* Tappable quantity badge */}
          <QuantityBadge
            quantity={config.quantity}
            quantityInput={config.quantityInput}
            unit={config.unit}
            onPress={() => onQuantityPress?.(config.itemId)}
            disabled={config.disabled}
            isPurchased={item.isPurchased}
          />

          {/* For purchased items, show "Move to Pantry" button */}
          {item.isPurchased && onMoveToPantry && (
            <TouchableOpacity
              onPress={() => onMoveToPantry(item.id)}
              style={styles.moveToPantryButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name="cupboard"
                size={24}
                color={theme.colors.primary}
                library="MaterialDesignIcons"
              />
            </TouchableOpacity>
          )}

          {/* For unpurchased items, show drag handle */}
          {!item.isPurchased && drag && (
            <DragHandle
              onLongPress={handleLongPress}
              disabled={item.isPurchased}
            />
          )}
        </View>
      );
    }

    // Priority 2: Use provided element
    return item.rightElement;
  }, [
    drag,
    item.isPurchased,
    item.id,
    item.rightElement,
    item.rightElementConfig,
    handleLongPress,
    onQuantityPress,
    onMoveToPantry,
    theme.colors.primary,
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
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      );
    }

    // Priority 2: Use provided element
    return item.leftElement;
  }, [item.leftElement, item.leftElementConfig]);

  // Create checkbox element for marking items as purchased
  // Uses onToggleComplete so animation plays BEFORE mutation moves item
  // When marking as purchased: slide right + fade out + height collapse
  // When unmarking: slide left + fade out + height collapse
  // Only shown if user has permission to mark items as purchased
  const checkboxElement = React.useMemo(() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;

    return (
      <AnimatedCheckbox
        checked={!!item.isPurchased}
        onToggleComplete={() => {
          // Direction: 1 = right (marking purchased), -1 = left (unmarking)
          const direction = item.isPurchased ? -1 : 1;
          // triggerExit handles animation + calls onComplete via runOnJS
          triggerExit(direction, () => {
            onTogglePurchase(item.id);
          });
        }}
        size={28}
      />
    );
  }, [
    item.isPurchased,
    item.id,
    onTogglePurchase,
    triggerExit,
    canMarkPurchased,
  ]);

  return (
    <Animated.View
      style={[
        styles.container,
        isActive && styles.activeContainer,
        exitAnimatedStyle,
      ]}
    >
      <SwipeableItem
        onPress={onItemPress ? () => onItemPress(item.id) : undefined}
        onLongPress={
          !drag && onItemPress ? () => onItemPress(item.id) : undefined
        }
        onEdit={
          canEditItems && onItemEdit ? () => onItemEdit(item.id) : undefined
        }
        onDelete={
          canRemoveItems && onItemDelete
            ? () => onItemDelete(item.id)
            : undefined
        }
        isPurchased={item.isPurchased}
        friction={1}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        swipeMode="shopping"
      >
        <ListItem
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          rightElement={rightElement}
          leftElement={leftElement}
          checkboxElement={checkboxElement}
          rightIcon={undefined}
          isPurchased={item.isPurchased}
        />
      </SwipeableItem>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    ...commonStyles.shadow,
    opacity: 1,
    marginHorizontal: theme.spacing.sm,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
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
  moveToPantryButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  rightElementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
}));

// PERFORMANCE: Custom comparator for React.memo
// Only re-render when item data or drag state changes
// Actions & permissions come from context (stable) so no need to compare them
const arePropsEqual = (
  prev: SimpleDraggableItemProps,
  next: SimpleDraggableItemProps,
): boolean => {
  // Fast path: same item reference + same drag state = definitely equal
  if (prev.item === next.item && prev.isActive === next.isActive) {
    return true;
  }

  // Compare item fields that affect rendering
  const prevConfig = prev.item.rightElementConfig;
  const nextConfig = next.item.rightElementConfig;

  return (
    prev.item.id === next.item.id &&
    prev.item.title === next.item.title &&
    prev.item.subtitle === next.item.subtitle &&
    prev.item.isPurchased === next.item.isPurchased &&
    prev.item.leftElementConfig === next.item.leftElementConfig &&
    prev.isActive === next.isActive &&
    // Deep compare quantity config since it affects display
    prevConfig?.quantity === nextConfig?.quantity &&
    prevConfig?.quantityInput === nextConfig?.quantityInput &&
    prevConfig?.unit === nextConfig?.unit &&
    prevConfig?.disabled === nextConfig?.disabled
  );
};

// PERFORMANCE: Memoize component with custom comparison
// Config object stability maintained by Map caching in useShoppingListScreen
export const SimpleDraggableItem = React.memo(
  SimpleDraggableItemComponent,
  arePropsEqual,
);
