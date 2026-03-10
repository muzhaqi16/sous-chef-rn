import React from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { SwipeableItem } from '#/components/molecules/SwipeableItem/SwipeableItem';
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
  TIMING,
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
  const entering = (() => {
    if (entryDelay <= 0) return undefined;
    return FadeIn.delay(entryDelay)
      .duration(staggeredEntryAnimation.duration)
      .easing(standardEasing.factory());
  })();

  // PERFORMANCE: Get screen width from context (single subscription at list level, not per-item)
  const screenWidth = themeColors?.screenWidth ?? 375;

  // Slide animation for purchase toggle
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: item.id,
    slideDistance: screenWidth,
    duration: TIMING.MODERATE,
  });

  // Get actions and permissions from context (stable references)
  const { actions, permissions } = useSortableListActions();
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

  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissions;

  // === ELEMENT CREATION ===

  // Create rightElement from config or use provided element
  const rightElement = (() => {
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
          {!!item.isPurchased && !!onMoveToPantry && (
            <Pressable
              onPress={() => onMoveToPantry(item.id)}
              style={({pressed}) => [styles.moveToPantryButton, pressed && styles.pressed]}
              hitSlop={HIT_SLOP}
            >
              <Icon
                name="archive-outline"
                size={24}
                color={themeColors?.primary}
              />
            </Pressable>
          )}
        </View>
      );
    }
    return item.rightElement;
  })();

  // Create leftElement from config or use provided element
  const leftElement = (() => {
    if (item.leftElementConfig?.type === 'image') {
      const config = item.leftElementConfig;
      return (
        <View
          style={[
            commonStyles.listItemImageContainerCompact,
            config.isPurchased && styles.dimmed,
          ]}
        >
          <CachedImage
            uri={config.url}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      );
    }
    return item.leftElement;
  })();

  // Create checkbox element for marking items as purchased
  // Uses AnimatedCheckbox with pendingChecked state for immediate visual feedback
  // Slide animation triggers state change via callback AFTER animation completes
  const checkboxElement = (() => {
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
        size={28}
        testID={`shopping-item-checkbox-${item.id}`}
      />
    );
  })();

  // Render the item
  // PERF: Single Animated.View for both entry animation and slide style
  return (
    <Animated.View
      entering={entering}
      style={[styles.container, animatedSlideStyle]}
    >
      <SwipeableItem
        itemId={item.id}
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
      </SwipeableItem>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
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
  dimmed: {
    opacity: 0.5,
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
