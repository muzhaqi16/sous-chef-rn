import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
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
import { useDragState } from './DragStateContext';
import { useListExitAnimation, useListEntryAnimation } from '#hooks/animations';
import { useListAnimationOptional } from '#/context/ListAnimationContext';
import { HapticService } from '#/services/haptic';
import { listItemExitAnimation } from '#/constants/animations';

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

  // Drag state for reordering (local to this item)
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  // Track if this item was recently dragged (to exclude from shiftAnimatedStyle)
  const wasRecentlyDragged = useSharedValue(false);

  // Track previous index to detect position changes (vs view recycling)
  const prevIndexRef = useRef(index);
  const prevItemIdRef = useRef(item.id);

  // Global drag state for coordinating shift animations across all items
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    currentTranslateY,
  } = useDragState();

  // Handle animation state when position changes
  // Two cases:
  // 1. item.id changes → View recycling: full reset
  // 2. index changes → Data reorder: compensate for base position shift
  // @see https://shopify.github.io/flash-list/docs/guides/reanimated/
  useEffect(() => {
    const ITEM_HEIGHT = listItemExitAnimation.itemHeight;

    // Case 1: View recycled to different item - full reset
    if (item.id !== prevItemIdRef.current) {
      isDragging.value = false;
      translateY.value = 0;
      scale.value = 1;
      wasRecentlyDragged.value = false;
      prevItemIdRef.current = item.id;
      prevIndexRef.current = index;
      return;
    }

    // Case 2: Same item, index changed (data reordered after drop via Apollo optimisticResponse)
    if (index !== prevIndexRef.current) {
      const indexDelta = index - prevIndexRef.current;
      const heightDelta = indexDelta * ITEM_HEIGHT;

      // Compensate translateY for the base position change
      // This prevents the snap-back: instead of resetting to 0,
      // we adjust by the height delta so visual position stays ~same
      const compensatedY = translateY.value - heightDelta;
      translateY.value = compensatedY;

      // Then smoothly animate to 0 (final resting position)
      translateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });

      // Reset other drag state
      isDragging.value = false;
      scale.value = 1;

      // Clear the recently dragged flag
      // This allows shiftAnimatedStyle to start applying again
      wasRecentlyDragged.value = false;

      prevIndexRef.current = index;
    }
  }, [index, item.id, isDragging, translateY, scale, wasRecentlyDragged]);

  // Store current values in refs for stable gesture callbacks
  // This prevents gesture recreation when these values change
  const dragContextRef = useRef({
    index,
    totalItems,
    itemId: item.id,
    onReorderByDelta,
  });

  // Keep ref in sync with current values
  dragContextRef.current = {
    index,
    totalItems,
    itemId: item.id,
    onReorderByDelta,
  };

  // Calculate new position and call reorder callback
  const handleDragEnd = useCallback((finalTranslateY: number) => {
    const { index: currentIndex, totalItems: total, itemId, onReorderByDelta: reorder } = dragContextRef.current;
    if (!reorder) return;

    // Calculate how many positions to move based on drag offset
    // Use centralized item height constant for consistency with exit animations
    const positionDelta = Math.round(finalTranslateY / listItemExitAnimation.itemHeight);
    if (positionDelta === 0) return; // No movement

    // Calculate new index, clamped to valid range
    const newIndex = Math.max(0, Math.min(total - 1, currentIndex + positionDelta));
    if (newIndex === currentIndex) return; // Same position

    // Call the parent callback with the delta - it will convert to neighbor IDs
    HapticService.medium();
    reorder(itemId, positionDelta);
  }, []); // Empty deps - uses ref for current values

  // Stable haptic callback for drag start - must be defined in RN Runtime scope
  // for scheduleOnRN to work correctly (cannot use arrow functions inside worklets)
  // @see https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN/
  const triggerLightHaptic = useCallback(() => {
    HapticService.light();
  }, []);

  // Reset wasRecentlyDragged after animation settles
  // This ensures the flag resets even if cache update doesn't change the item's index
  // (which would otherwise leave the item "stuck" with wasRecentlyDragged = true)
  const resetWasRecentlyDraggedDelayed = useCallback(() => {
    setTimeout(() => {
      wasRecentlyDragged.value = false;
    }, 250); // Slightly longer than animation duration (200ms) to ensure it settles
  }, [wasRecentlyDragged]);

  // Pan gesture for drag-to-reorder (attached to drag handle only)
  // Using drag handle avoids gesture conflicts with Swipeable and TouchableOpacity
  // activateAfterLongPress requires holding the drag handle to start dragging
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(200) // Require 200ms long press to start drag
        .onStart(() => {
          'worklet';
          // Local drag state
          isDragging.value = true;
          wasRecentlyDragged.value = true; // Mark as recently dragged to exclude from shiftAnimatedStyle
          scale.value = withSpring(DRAG_SCALE, { damping: 15, stiffness: 400 });
          // Global drag state for shift animations
          globalIsDragging.value = true;
          draggedIndex.value = index;
          currentTranslateY.value = 0;
          // Pass function reference (not arrow function) - must be defined in RN Runtime scope
          scheduleOnRN(triggerLightHaptic);
        })
        .onUpdate((event) => {
          'worklet';
          // Local drag state
          translateY.value = event.translationY;
          // Global drag state for shift animations
          currentTranslateY.value = event.translationY;
        })
        .onEnd((event) => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          const finalY = event.translationY;
          // Don't reset translateY here - useEffect resets it on index change
          // This prevents the snap-back flicker on drop
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });

          // Global drag state - full reset
          // Pre-mutation cache.modify handles immediate UI update, no need for hold-shift
          globalIsDragging.value = false;
          draggedIndex.value = -1;
          currentTranslateY.value = 0;

          // Pass function reference with argument - scheduleOnRN(fn, ...args) syntax
          scheduleOnRN(handleDragEnd, finalY);

          // Reset wasRecentlyDragged after a delay to ensure animation settles
          // This prevents items from getting stuck if cache update doesn't change their index
          scheduleOnRN(resetWasRecentlyDraggedDelayed);
        })
        .onFinalize(() => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          wasRecentlyDragged.value = false; // Reset flag on cancelled gesture
          // Don't reset translateY here - useEffect resets it on index change
          // This prevents the snap-back flicker on drop
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
          // Global drag state - full reset (onFinalize is for cancelled gestures, no reorder)
          globalIsDragging.value = false;
          draggedIndex.value = -1;
          currentTranslateY.value = 0;
        }),
    [isDragging, translateY, scale, handleDragEnd, triggerLightHaptic, globalIsDragging, draggedIndex, currentTranslateY, index, wasRecentlyDragged, resetWasRecentlyDraggedDelayed],
  );

  // Animated style for drag offset with scale and shadow (for the dragged item)
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
      // Keep elevated while dragging OR while translateY offset exists
      // Prevents rendering under other items during drop transition
      zIndex: isDragging.value || Math.abs(translateY.value) > 1 ? 999 : 0,
      shadowOpacity,
      elevation: isDragging.value ? 12 : 4,
    };
  });

  // Animated style for shift animation (for non-dragged items)
  // When another item is being dragged, this item shifts up/down to make space
  // Uses withTiming for smooth slide (no bounce) - bouncing is only for dragged item
  //
  // Note: We no longer need "hold-shift" logic because Apollo optimisticResponse
  // immediately updates the item order on drop. The useEffect compensation handles
  // the animation from current position to 0.
  const shiftAnimatedStyle = useAnimatedStyle(() => {
    // If I'm the dragged item OR was recently dragged, don't apply any shift transform
    // dragAnimatedStyle handles the dragged item's movement
    // wasRecentlyDragged prevents interference during drop animation settling
    if (draggedIndex.value === index || wasRecentlyDragged.value) {
      return {};
    }

    // Not dragging - no shift needed
    // Apollo optimisticResponse handles the reorder, items animate via useEffect compensation
    if (!globalIsDragging.value) {
      return {};
    }

    // During active drag - calculate shift based on current position
    const ITEM_HEIGHT = listItemExitAnimation.itemHeight;
    const hoveredIndex = draggedIndex.value + Math.round(currentTranslateY.value / ITEM_HEIGHT);

    let shiftY = 0;

    // Moving DOWN: items between original and hovered positions shift UP
    if (hoveredIndex > draggedIndex.value) {
      if (index > draggedIndex.value && index <= hoveredIndex) {
        shiftY = -ITEM_HEIGHT;
      }
    }
    // Moving UP: items between hovered and original positions shift DOWN
    else if (hoveredIndex < draggedIndex.value) {
      if (index < draggedIndex.value && index >= hoveredIndex) {
        shiftY = ITEM_HEIGHT;
      }
    }

    // Smooth slide without bounce - easeOut for natural deceleration
    return {
      transform: [{ translateY: withTiming(shiftY, { duration: 200, easing: Easing.out(Easing.ease) }) }],
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
        shiftAnimatedStyle, // Shift animation for non-dragged items
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
      {/* Pre-activate items with drag handles so RNGH gestures work on first touch */}
      <LazySwipeableItem
        isPreActivated={isDragEnabled}
        onPress={onItemPress ? () => onItemPress(item.id) : undefined}
        // Don't pass onLongPress when drag is enabled - allows pan gesture to activate
        // For purchased items (no drag), long-press still opens item details
        onLongPress={!isDragEnabled && onItemPress ? () => onItemPress(item.id) : undefined}
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
