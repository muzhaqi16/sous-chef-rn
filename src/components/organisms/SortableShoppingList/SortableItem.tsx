import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { LazySwipeableItem } from '#/components/molecules/SwipeableItem/LazySwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { LazyAnimatedCheckbox } from '#/components/atoms/LazyAnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { commonStyles } from '#/styles';
import { Icon, createPropsComparator } from '#utils';
import { HIT_SLOP } from '#/constants/touch';
import type { QuantityElementConfig, ImageElementConfig } from './types';
import { useSortableListActions } from './SortableListActionsContext';
import { useSortableListTheme } from './SortableListThemeContext';
import { useListExitAnimation, useListEntryAnimation } from '#hooks/animations';
import { useListAnimationOptional } from '#/context/ListAnimationContext';
import {
  useDragGesture,
  useDragShift,
  useDropCompensation,
  useDragAnimatedStyle,
} from '#/hooks/drag';

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
    rightElementConfig?: QuantityElementConfig;
    leftElement?: React.ReactNode;
    leftElementConfig?: ImageElementConfig;
  };
  /** Current index in the list */
  index: number;
  /** Total number of items in the list */
  totalItems: number;
  isActive?: boolean;
}

const SimpleDraggableItemComponent: React.FC<SimpleDraggableItemProps> = ({
  item,
  index,
  totalItems,
  isActive,
}) => {
  // PERFORMANCE: Get theme colors from context (single useUnistyles at list level)
  const themeColors = useSortableListTheme();

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
    prepareForLayoutAnimation,
    onReorderByDelta,
  } = actions;

  // Read permissions from ref to always get latest values
  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
    canReorderItems = false,
  } = permissionsRef.current;

  // Determine if drag is enabled for this item
  const isDragEnabled =
    !item.isPurchased && canReorderItems && !!onReorderByDelta;

  // Animated ref for measuring item height on drag start
  const containerRef = useAnimatedRef<Animated.View>();

  // === DRAG HOOKS (replace ~300 lines of inline logic) ===

  // Pan gesture for drag-to-reorder
  const { panGesture, isDragging, translateY } = useDragGesture(
    {
      itemId: item.id,
      index,
      totalItems,
      enabled: isDragEnabled,
      containerRef,
    },
    { onReorderByDelta },
  );

  // Shift animation for non-dragged items
  const { shiftY } = useDragShift({ itemId: item.id, index });

  // Handle index changes after cache updates (drop compensation)
  useDropCompensation({ itemId: item.id, index, translateY, shiftY });

  // Animated style for drag transforms
  const { dragAnimatedStyle } = useDragAnimatedStyle(
    item.id,
    isDragging,
    translateY,
    shiftY,
  );

  // === ANIMATION HOOKS ===

  // Exit animation for smooth slide-out when toggling purchase state
  const { exitAnimatedStyle, triggerExit } = useListExitAnimation(item.id);

  // Entry animation for items appearing in destination list after move
  const { entryAnimatedStyle } = useListEntryAnimation(item.id);

  // List animation context for subscription-triggered animations
  const animationContext = useListAnimationOptional();

  // Register exit animation trigger (O(1) direct calls from subscriptions)
  useLayoutEffect(() => {
    if (!animationContext) return;
    animationContext.registerAnimationTrigger(item.id, triggerExit);
    return () => animationContext.unregisterAnimationTrigger(item.id);
  }, [item.id, triggerExit, animationContext]);

  // Animated toggle handler - triggers slide animation then calls toggle
  const handleAnimatedToggle = useCallback(() => {
    const direction = item.isPurchased ? -1 : 1;
    triggerExit(direction, () => {
      prepareForLayoutAnimation?.();
      onTogglePurchase?.(item.id);
    });
  }, [
    item.id,
    item.isPurchased,
    onTogglePurchase,
    triggerExit,
    prepareForLayoutAnimation,
  ]);

  // === ELEMENT CREATION (kept inline per user request - state only in hooks) ===

  // Create rightElement from config or use provided element
  const rightElement = useMemo(() => {
    if (item.rightElementConfig?.type === 'quantity') {
      const config = item.rightElementConfig;
      return (
        <View style={styles.rightElementContainer}>
          <QuantityBadge
            quantity={config.quantity}
            quantityInput={config.quantityInput}
            unit={config.unit}
            onPress={() => onQuantityPress?.(config.itemId)}
            disabled={config.disabled}
            isPurchased={item.isPurchased}
            themeColors={themeColors}
          />
          {item.isPurchased && onMoveToPantry && (
            <TouchableOpacity
              onPress={() => onMoveToPantry(item.id)}
              style={styles.moveToPantryButton}
              hitSlop={HIT_SLOP}
            >
              <Icon
                name="cupboard"
                size={24}
                color={themeColors?.primary}
                library="MaterialDesignIcons"
              />
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return item.rightElement;
  }, [
    item.isPurchased,
    item.id,
    item.rightElement,
    item.rightElementConfig,
    onQuantityPress,
    onMoveToPantry,
    themeColors,
  ]);

  // Memoize image source to prevent recreation
  const imageSource = useMemo(() => {
    if (item.leftElementConfig?.type === 'image') {
      return { uri: item.leftElementConfig.url };
    }
    return undefined;
  }, [item.leftElementConfig?.url, item.leftElementConfig?.type]);

  // Create leftElement from config or use provided element
  const leftElement = useMemo(() => {
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
            source={imageSource}
            style={commonStyles.listItemImage}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      );
    }
    return item.leftElement;
  }, [item.leftElement, item.leftElementConfig, imageSource]);

  // Create checkbox element for marking items as purchased
  const checkboxElement = useMemo(() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;
    return (
      <LazyAnimatedCheckbox
        checked={!!item.isPurchased}
        onPress={handleAnimatedToggle}
        size={28}
        primaryColor={themeColors?.primary}
        borderColor={themeColors?.border}
      />
    );
  }, [
    item.isPurchased,
    handleAnimatedToggle,
    onTogglePurchase,
    canMarkPurchased,
    themeColors,
  ]);

  // Create drag handle element for reordering
  const dragHandleElement = useMemo(() => {
    if (item.isPurchased || !canReorderItems || !onReorderByDelta) return null;
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.dragHandle}>
          <Icon
            name="drag-indicator"
            size={20}
            color={themeColors?.textSecondary}
            library="MaterialIcons"
          />
        </Animated.View>
      </GestureDetector>
    );
  }, [
    item.isPurchased,
    canReorderItems,
    onReorderByDelta,
    themeColors,
    panGesture,
  ]);

  // Safety guard: skip rendering if item is invalid
  if (!item?.id || !item?.title) {
    if (__DEV__) {
      console.warn('⚠️ SortableItem: Invalid item data, skipping render');
    }
    return null;
  }

  // Render the item with drag animation applied when dragging
  return (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        exitAnimatedStyle,
        entryAnimatedStyle,
        isDragEnabled && dragAnimatedStyle,
        isActive && {
          opacity: 0.98,
          shadowColor: themeColors?.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
      ]}
    >
      <LazySwipeableItem
        isPreActivated={isDragEnabled}
        onPress={onItemPress ? () => onItemPress(item.id) : undefined}
        onLongPress={
          !isDragEnabled && onItemPress ? () => onItemPress(item.id) : undefined
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
          dragHandleElement={dragHandleElement}
          rightIcon={undefined}
          isPurchased={item.isPurchased}
          themeColors={themeColors}
        />
      </LazySwipeableItem>
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
  moveToPantryButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  rightElementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dragHandle: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
}));

// PERFORMANCE: Custom comparator for React.memo
const arePropsEqual = createPropsComparator<SimpleDraggableItemProps>({
  referenceKeys: ['isActive', 'index', 'totalItems'],
  nestedComparisons: {
    item: ['id', 'title', 'subtitle', 'isPurchased', 'leftElementConfig'],
    'item.rightElementConfig': [
      'quantity',
      'quantityInput',
      'unit',
      'disabled',
    ],
  },
});

export const SimpleDraggableItem = React.memo(
  SimpleDraggableItemComponent,
  arePropsEqual,
);
