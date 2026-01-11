import React, { useCallback, useLayoutEffect } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { LazySwipeableItem } from '#/components/molecules/SwipeableItem/LazySwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { LazyAnimatedCheckbox } from '#/components/atoms/LazyAnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { commonStyles } from '#/styles';
import { Icon, createPropsComparator } from '#utils';
import type { QuantityElementConfig, ImageElementConfig } from './types';
import { useSortableListActions } from './SortableListActionsContext';
import { useSortableListTheme } from './SortableListThemeContext';
import { useListExitAnimation, useListEntryAnimation } from '#hooks/animations';
import { useListAnimationOptional } from '#/context/ListAnimationContext';

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
  isActive?: boolean;
}

const SimpleDraggableItemComponent: React.FC<SimpleDraggableItemProps> = ({
  item,
  isActive,
}) => {
  // PERFORMANCE: Get theme colors from context (single useUnistyles at list level)
  // This eliminates 7-8 useUnistyles calls per item
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

  // Exit animation for smooth slide-out when toggling purchase state
  // IMPORTANT: Pass item.id so animation state resets when FlashList recycles views
  const { exitAnimatedStyle, triggerExit } = useListExitAnimation(item.id);

  // List animation context for subscription-triggered animations
  const animationContext = useListAnimationOptional();

  // PERFORMANCE: Register exit animation trigger via useLayoutEffect (O(1) direct calls)
  // When subscription schedules an animation, it calls the registered trigger directly
  // instead of updating context state and causing O(n) re-renders
  useLayoutEffect(() => {
    if (!animationContext) return;

    // Register this item's animation trigger function
    animationContext.registerAnimationTrigger(item.id, triggerExit);

    return () => {
      // Clean up registration on unmount (handles FlashList view recycling)
      animationContext.unregisterAnimationTrigger(item.id);
    };
  }, [item.id, triggerExit, animationContext]);

  // Entry animation for items appearing in destination list after move
  const { entryAnimatedStyle } = useListEntryAnimation(item.id);

  // Animated toggle handler - triggers slide animation then calls toggle
  const handleAnimatedToggle = useCallback(() => {
    // Prepare FlashList for layout change BEFORE animation starts
    // This is required for FlashList to properly handle item removal
    // @see https://shopify.github.io/flash-list/docs/guides/layout-animation
    prepareForLayoutAnimation?.();

    // Slide right when marking as purchased (not currently purchased)
    // Slide left when unmarking (currently purchased)
    const direction = item.isPurchased ? -1 : 1;
    triggerExit(direction, () => {
      onTogglePurchase?.(item.id);
    });
  }, [item.id, item.isPurchased, onTogglePurchase, triggerExit, prepareForLayoutAnimation]);

  // Create rightElement from config or use provided element
  // Uses QuantityBadge (tappable) + MoveToPantry button for purchased items
  const rightElement = React.useMemo(() => {
    // Priority 1: Use config-based element (performance optimized)
    if (item.rightElementConfig?.type === 'quantity') {
      const config = item.rightElementConfig;

      return (
        <View style={styles.rightElementContainer}>
          {/* Tappable quantity badge */}
          {/* PERFORMANCE: Pass themeColors to avoid useUnistyles in QuantityBadge */}
          <QuantityBadge
            quantity={config.quantity}
            quantityInput={config.quantityInput}
            unit={config.unit}
            onPress={() => onQuantityPress?.(config.itemId)}
            disabled={config.disabled}
            isPurchased={item.isPurchased}
            themeColors={themeColors}
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
                color={themeColors?.primary}
                library="MaterialDesignIcons"
              />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Priority 2: Use provided element
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

  // PERFORMANCE: Memoize image source object to prevent recreation on every render
  // This prevents Image component from thinking source changed
  const imageSource = React.useMemo(() => {
    if (item.leftElementConfig?.type === 'image') {
      return { uri: item.leftElementConfig.url };
    }
    return undefined;
  }, [item.leftElementConfig?.url, item.leftElementConfig?.type]);

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
            source={imageSource}
            style={commonStyles.listItemImage}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      );
    }

    // Priority 2: Use provided element
    return item.leftElement;
  }, [item.leftElement, item.leftElementConfig, imageSource]);

  // Create checkbox element for marking items as purchased
  // Only shown if user has permission to mark items as purchased
  // PERFORMANCE: Uses LazyAnimatedCheckbox which avoids useSharedValue/useAnimatedStyle
  // PERFORMANCE: Pass colors to avoid useUnistyles in checkbox
  const checkboxElement = React.useMemo(() => {
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
  }, [item.isPurchased, handleAnimatedToggle, onTogglePurchase, canMarkPurchased, themeColors]);

  // Use Animated.View for exit + entry animations + inline conditional for active state
  return (
    <Animated.View
      style={[
        styles.container,
        exitAnimatedStyle,
        entryAnimatedStyle,
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
      {/* PERFORMANCE: LazySwipeableItem defers expensive Swipeable setup until first touch */}
      <LazySwipeableItem
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
        {/* PERFORMANCE: Pass themeColors to avoid useUnistyles in ListItem */}
        <ListItem
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          rightElement={rightElement}
          leftElement={leftElement}
          checkboxElement={checkboxElement}
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
}));

// PERFORMANCE: Custom comparator for React.memo
// Only re-render when item data or drag state changes
// Actions & permissions come from context (stable) so no need to compare them
const arePropsEqual = createPropsComparator<SimpleDraggableItemProps>({
  referenceKeys: ['isActive'],
  nestedComparisons: {
    item: ['id', 'title', 'subtitle', 'isPurchased', 'leftElementConfig'],
    'item.rightElementConfig': ['quantity', 'quantityInput', 'unit', 'disabled'],
  },
});

// PERFORMANCE: Memoize component with custom comparison
// Custom comparator needed because config objects are recreated each render in useShoppingListTransform.
// Compares actual field values to prevent unnecessary re-renders when data hasn't changed.
export const SimpleDraggableItem = React.memo(
  SimpleDraggableItemComponent,
  arePropsEqual,
);
