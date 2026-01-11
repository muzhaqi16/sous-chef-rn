import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
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
import { HapticService } from '#/services/haptic';

// Approximate item height for drag calculations (87px content + 16px margin)
const ITEM_HEIGHT = 103;

// Drag animation constants
const DRAG_SCALE = 1.03;
const DRAG_SHADOW_OPACITY = 0.25;

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
  // This eliminates 7-8 useUnistyles calls per item
  const themeColors = useSortableListTheme();

  // Get actions and permissions from context (stable references)
  // NOTE: All hooks must be called before any early returns (Rules of Hooks)
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

  // Drag state for reordering
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Calculate new position and call reorder callback
  const handleDragEnd = useCallback(
    (finalTranslateY: number) => {
      if (!onReorderByDelta) return;

      // Calculate how many positions to move based on drag offset
      const positionDelta = Math.round(finalTranslateY / ITEM_HEIGHT);
      if (positionDelta === 0) return; // No movement

      // Calculate new index, clamped to valid range
      const newIndex = Math.max(0, Math.min(totalItems - 1, index + positionDelta));
      if (newIndex === index) return; // Same position

      // Call the parent callback with the delta - it will convert to neighbor IDs
      HapticService.medium();
      onReorderByDelta(item.id, positionDelta);
    },
    [index, totalItems, item.id, onReorderByDelta],
  );

  // Pan gesture for drag-to-reorder (attached to drag handle only)
  // Using drag handle avoids gesture conflicts with Swipeable and TouchableOpacity
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          isDragging.value = true;
          scale.value = withSpring(DRAG_SCALE, { damping: 15, stiffness: 400 });
          scheduleOnRN(() => HapticService.light());
        })
        .onUpdate((event) => {
          'worklet';
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          'worklet';
          isDragging.value = false;
          const finalY = event.translationY;
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
          scheduleOnRN(() => handleDragEnd(finalY));
        })
        .onFinalize(() => {
          'worklet';
          isDragging.value = false;
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }),
    [isDragging, translateY, scale, handleDragEnd],
  );

  // Animated style for drag offset with scale and shadow
  const dragAnimatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      scale.value,
      [1, DRAG_SCALE],
      [0.1, DRAG_SHADOW_OPACITY],
    );

    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: isDragging.value ? 999 : 0,
      shadowOpacity,
      elevation: isDragging.value ? 12 : 4,
    };
  });

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

  // Create drag handle element for reordering
  // Wrapped with GestureDetector to handle pan gesture on the handle only
  // This avoids conflicts with Swipeable and other touch handlers
  const dragHandleElement = React.useMemo(() => {
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
  }, [item.isPurchased, canReorderItems, onReorderByDelta, themeColors, panGesture]);

  // Safety guard: skip rendering if item is invalid (prevents empty items)
  // NOTE: This check must come AFTER all hooks to comply with Rules of Hooks
  if (!item?.id || !item?.title) {
    if (__DEV__) {
      console.warn('⚠️ SortableItem: Invalid item data, skipping render');
    }
    return null;
  }

  // Determine if drag is enabled for this item
  const isDragEnabled = !item.isPurchased && canReorderItems && !!onReorderByDelta;

  // Render the item with drag animation applied when dragging
  return (
    <Animated.View
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
    // Ensure the drag handle is above other elements for touch
    zIndex: 10,
  },
}));

// PERFORMANCE: Custom comparator for React.memo
// Only re-render when item data or drag state changes
// Actions & permissions come from context (stable) so no need to compare them
const arePropsEqual = createPropsComparator<SimpleDraggableItemProps>({
  referenceKeys: ['isActive', 'index', 'totalItems'],
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
