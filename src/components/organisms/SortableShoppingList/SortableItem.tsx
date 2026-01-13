import React, { useMemo } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import type { AnimatedRenderItemInfo } from '@souschef/reanimated-flashlist';
import { LazySwipeableItem } from '#/components/molecules/SwipeableItem/LazySwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { AnimatedCheckbox } from '#/components/atoms/AnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { commonStyles } from '#/styles';
import { Icon, createPropsComparator } from '#utils';
import { HIT_SLOP } from '#/constants/touch';
import type { QuantityElementConfig, ImageElementConfig } from './types';
import { useSortableListActions } from './SortableListActionsContext';
import { useSortableListTheme } from './SortableListThemeContext';

// Item data structure
interface ItemData {
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
}

/**
 * Props for SimpleDraggableItem - extends AnimatedRenderItemInfo from the package
 * Receives animation props from AnimatedFlashList's renderItem callback
 */
type SimpleDraggableItemProps = AnimatedRenderItemInfo<ItemData>;

const SimpleDraggableItemComponent: React.FC<SimpleDraggableItemProps> = ({
  item,
  animatedStyle,
  dragHandleProps,
  isDragEnabled,
  triggerExitAnimation,
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
  } = actions;

  // Read permissions from ref to always get latest values
  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissionsRef.current;

  // === ELEMENT CREATION ===

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
  // Uses AnimatedCheckbox with pendingChecked state for immediate visual feedback
  const checkboxElement = useMemo(() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;
    return (
      <AnimatedCheckbox
        checked={!!item.isPurchased}
        onPress={() => {
          // Trigger exit animation immediately when checkbox is pressed
          // Direction: 1 = right (marking as purchased), -1 = left (unmarking)
          const direction = item.isPurchased ? -1 : 1;
          triggerExitAnimation(direction, () => {
            prepareForLayoutAnimation?.();
            onTogglePurchase?.(item.id);
          }, 'fast');
        }}
        animationDuration={200} // Match exit animation duration
        size={28}
      />
    );
  }, [
    item.id,
    item.isPurchased,
    onTogglePurchase,
    canMarkPurchased,
    triggerExitAnimation,
    prepareForLayoutAnimation,
  ]);

  // Create drag handle element for reordering
  // Uses dragHandleProps from AnimatedFlashList
  const dragHandleElement = useMemo(() => {
    if (!isDragEnabled || !dragHandleProps) return null;
    return (
      <GestureDetector gesture={dragHandleProps.gesture}>
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
  }, [isDragEnabled, dragHandleProps, themeColors]);

  // Safety guard: skip rendering if item is invalid
  if (!item?.id || !item?.title) {
    if (__DEV__) {
      console.warn('⚠️ SortableItem: Invalid item data, skipping render');
    }
    return null;
  }

  // Render the item with animation style from AnimatedFlashList
  return (
    <Animated.View style={[styles.container, animatedStyle]}>
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
          canRemoveItems && onItemDelete ? () => onItemDelete(item.id) : undefined
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
  referenceKeys: ['index', 'totalItems', 'isDragEnabled', 'isDragging'],
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
