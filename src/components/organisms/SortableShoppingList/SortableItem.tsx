import React, { useCallback, useRef, useEffect } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { LazySwipeableItem } from '#/components/molecules/SwipeableItem/LazySwipeableItem';
import { ListItem } from '#/components/molecules/ListItem';
import { DragHandle } from '#/components/atoms/DragHandle';
import { LazyAnimatedCheckbox } from '#/components/atoms/LazyAnimatedCheckbox';
import { QuantityBadge } from '#/components/atoms/QuantityBadge';
import { commonStyles } from '#/styles';
import { HapticService } from '#services/haptic';
import { Icon } from '#utils';
import type { QuantityElementConfig, ImageElementConfig } from './types';
import { useSortableListActions } from './SortableListActionsContext';
import { useSortableListTheme } from './SortableListThemeContext';
import { useItemExitAnimation } from '#/hooks/animations/useItemExitAnimation';

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
  // PERF DIAGNOSTICS: Track render time for this item
  const renderStartRef = useRef(Date.now());
  const renderCountRef = useRef(0);

  // Log slow renders in development (sampled to reduce overhead)
  useEffect(() => {
    if (__DEV__) {
      renderCountRef.current++;

      // PERFORMANCE: Only log every 10th render to reduce console overhead
      // This dramatically reduces JS thread blocking from console.log calls
      if (renderCountRef.current % 10 === 1) {
        const renderTime = Date.now() - renderStartRef.current;

        // Only log slow renders (>16ms = dropped frame potential)
        if (renderTime > 16) {
          console.log(`[PERF] Slow render: "${item.title.slice(0, 15)}" ${renderTime}ms (render #${renderCountRef.current})`);
        }
      }
    }
  });

  // Reset render start time for next render measurement
  renderStartRef.current = Date.now();

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
  } = actions;
  // Read permissions from ref to always get latest values
  const {
    canRemoveItems = true,
    canEditItems = true,
    canMarkPurchased = true,
  } = permissionsRef.current;

  // Exit animation hook for smooth slide-out when toggling purchase state
  const { exitAnimatedStyle, triggerExit } = useItemExitAnimation();

  // Handle animated toggle with exit animation before mutation
  const handleAnimatedToggle = useCallback(() => {
    if (!onTogglePurchase) return;

    // Direction: 1 = slide right (marking purchased), -1 = slide left (unmarking)
    const direction = item.isPurchased ? -1 : 1;

    triggerExit(direction, () => {
      onTogglePurchase(item.id);
      // Don't reset animation - item will be removed from DOM shortly
      // Animation state is garbage collected on unmount
    });
  }, [item.isPurchased, item.id, onTogglePurchase, triggerExit]);

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

          {/* For unpurchased items, show drag handle */}
          {/* PERFORMANCE: Pass iconColor to avoid useUnistyles call in DragHandle */}
          {!item.isPurchased && drag && (
            <DragHandle
              onLongPress={handleLongPress}
              disabled={item.isPurchased}
              iconColor={themeColors?.textSecondary}
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
  // Uses handleAnimatedToggle for smooth exit animation before mutation
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

  // Use single Unistyles style + inline conditional to avoid "2 unistyles styles" warning
  // Animated.View enables smooth exit animation when toggling purchase state
  return (
    <Animated.View
      style={[
        styles.container,
        exitAnimatedStyle,
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
