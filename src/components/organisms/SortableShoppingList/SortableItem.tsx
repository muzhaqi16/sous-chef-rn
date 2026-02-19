import React, { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { LazySwipeableItem } from '#/components/molecules/SwipeableItem/LazySwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { AnimatedCheckbox } from '#/components/atoms/AnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { CachedImage } from '#/components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#utils/iconUtils';
import { createPropsComparator } from '#utils/memoUtils';
import { HIT_SLOP } from '#/constants/touch';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import {
  standardEasing,
  staggeredEntryAnimation,
} from '#constants/animations';
import { useStaggeredEntry } from '#context/StaggeredEntryContext';
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
 * Props for SwipeableListItem - extends ListRenderItemInfo from FlashList
 */
type SwipeableListItemProps = ListRenderItemInfo<ItemData>;

const SwipeableListItemComponent: React.FC<SwipeableListItemProps> = ({
  item,
  index,
}) => {
  // PERFORMANCE: Get theme colors from context (single useUnistyles at list level)
  const themeColors = useSortableListTheme();

  // Staggered entry animation (only during initial render, disabled after)
  const staggerCtx = useStaggeredEntry();
  const entryDelay = staggerCtx?.getEntryDelay(index) ?? 0;
  const entering = useMemo(() => {
    if (entryDelay <= 0) return undefined;
    return FadeIn.delay(entryDelay)
      .duration(staggeredEntryAnimation.duration)
      .easing(standardEasing.factory());
  }, [entryDelay]);

  // PERFORMANCE: Get screen width from context (single subscription at list level, not per-item)
  const screenWidth = themeColors?.screenWidth ?? 375;

  // Slide animation for purchase toggle
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: item.id,
    slideDistance: screenWidth,
    duration: 250,
  });

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
            <Pressable
              onPress={() => onMoveToPantry(item.id)}
              style={({pressed}) => [styles.moveToPantryButton, pressed && styles.pressed]}
              hitSlop={HIT_SLOP}
            >
              <Icon
                name="cupboard"
                size={24}
                color={themeColors?.primary}
                library="MaterialDesignIcons"
              />
            </Pressable>
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

  // Create leftElement from config or use provided element
  const leftElement = useMemo(() => {
    if (item.leftElementConfig?.type === 'image') {
      const config = item.leftElementConfig;
      return (
        <View
          style={[
            commonStyles.listItemImageContainerCompact,
            config.isPurchased && { opacity: 0.5 },
          ]}
        >
          <CachedImage
            uri={config.url}
            style={commonStyles.listItemImageCompact}
          />
        </View>
      );
    }
    return item.leftElement;
  }, [item.leftElement, item.leftElementConfig]);

  // Create checkbox element for marking items as purchased
  // Uses AnimatedCheckbox with pendingChecked state for immediate visual feedback
  // Slide animation triggers state change via callback AFTER animation completes
  const checkboxElement = useMemo(() => {
    if (!onTogglePurchase || !canMarkPurchased) return null;
    return (
      <AnimatedCheckbox
        checked={!!item.isPurchased}
        itemId={item.id}
        onPress={() => {
          // Direction: 1 = right (marking as purchased), -1 = left (unmarking)
          const direction = item.isPurchased ? -1 : 1;
          // Trigger slide animation with callback for state change AFTER animation
          triggerSlide(direction, () => {
            onTogglePurchase(item.id);
          });
        }}
        animationDuration={200}
        size={28}
        testID={`shopping-item-checkbox-${item.id}`}
      />
    );
  }, [item.id, item.isPurchased, onTogglePurchase, canMarkPurchased, triggerSlide]);

  // Safety guard: skip rendering if item is invalid
  if (!item?.id || !item?.title) {
    if (__DEV__) {
      console.warn('⚠️ SortableItem: Invalid item data, skipping render');
    }
    return null;
  }

  // Render the item
  // PERF: Nested Animated.Views separate entry animation from slide animation
  // This prevents Reanimated warning about conflicting opacity/transform properties
  return (
    <Animated.View entering={entering}>
      <Animated.View
        style={[styles.container, commonStyles.shadow, animatedSlideStyle]}
      >
        <LazySwipeableItem
        isPreActivated={false}
        onPress={onItemPress ? () => onItemPress(item.id) : undefined}
        onLongPress={onItemPress ? () => onItemPress(item.id) : undefined}
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
          dragHandleElement={null}
          rightIcon={undefined}
          isPurchased={item.isPurchased}
          themeColors={themeColors}
        />
        </LazySwipeableItem>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    opacity: 1,
    marginHorizontal: theme.spacing.md,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

// PERFORMANCE: Custom comparator for React.memo
const arePropsEqual = createPropsComparator<SwipeableListItemProps>({
  referenceKeys: ['index'],
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

export const SwipeableListItem = React.memo(
  SwipeableListItemComponent,
  arePropsEqual,
);
