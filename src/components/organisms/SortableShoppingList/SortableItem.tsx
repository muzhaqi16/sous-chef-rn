import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRecyclingState } from '@shopify/flash-list';
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

  // Local drag state for this item's animation
  // Note: We keep local translateY for drop compensation (index change tracking)
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);
  // Shift animation SharedValue - animated via useAnimatedReaction to avoid
  // starting new animations every frame (which causes thrashing)
  const shiftY = useSharedValue(0);

  // Use FlashList's useRecyclingState for automatic reset on view recycling
  // This replaces manual tracking with prevItemIdRef/prevIndexRef
  // When item.id changes (view recycled), state resets automatically
  const [prevIndex, setPrevIndex] = useRecyclingState(index, [item.id]);

  // Global drag state for coordinating animations across all items
  // - isDragging/draggedIndex: identify which item is being dragged
  // - currentTranslateY: gesture offset for shift calculations
  // - draggedScale: scale animation (centralized, not per-item)
  // - isSettling: prevents shift animations during cache update window
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    currentTranslateY,
    draggedScale,
    isSettling,
  } = useDragState();

  // Handle index changes after cache updates (drop compensation)
  // useRecyclingState auto-resets prevIndex when item.id changes (view recycling)
  // useEffect handles the case where same item's index changes (after reorder)
  useEffect(() => {
    if (index !== prevIndex) {
      const ITEM_HEIGHT = listItemExitAnimation.itemHeight;
      const indexDelta = index - prevIndex;
      const heightDelta = indexDelta * ITEM_HEIGHT;

      // Compensate translateY for the base position change
      // This prevents the snap-back: instead of resetting to 0,
      // we adjust by the height delta so visual position stays ~same
      const compensatedY = translateY.value - heightDelta;
      translateY.value = compensatedY;

      // Then smoothly animate to 0 (final resting position)
      translateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });

      // Reset local drag state
      isDragging.value = false;

      // Update tracked index (safe inside useEffect)
      setPrevIndex(index);
    }
  }, [index, prevIndex, translateY, isDragging, setPrevIndex]);

  // Shift animation using useAnimatedReaction
  // This pattern only triggers withTiming when the target ACTUALLY changes,
  // unlike putting withTiming inside useAnimatedStyle which runs every frame (~60fps)
  useAnimatedReaction(
    () => {
      'worklet';
      // CRITICAL: Read ALL SharedValues FIRST, unconditionally
      // This ensures Reanimated tracks them all as dependencies.
      // Early returns before reading a SharedValue will cause that value
      // to NOT be tracked, so changes won't trigger re-evaluation!
      const currentDraggedIndex = draggedIndex.value;
      const isDraggingNow = globalIsDragging.value;
      const settlingNow = isSettling.value;
      const translateYNow = currentTranslateY.value;

      // Now do conditional logic using the captured values
      // If I'm the dragged item, no shift needed
      if (currentDraggedIndex === index) return 0;

      // If not dragging and not settling, reset to 0
      if (!isDraggingNow && !settlingNow) return 0;

      // Calculate which index the dragged item is hovering over
      const ITEM_HEIGHT = listItemExitAnimation.itemHeight;
      const hoveredIndex = currentDraggedIndex + Math.round(translateYNow / ITEM_HEIGHT);

      // Moving DOWN: items between original and hovered positions shift UP
      if (hoveredIndex > currentDraggedIndex) {
        if (index > currentDraggedIndex && index <= hoveredIndex) {
          return -ITEM_HEIGHT;
        }
      }
      // Moving UP: items between hovered and original positions shift DOWN
      else if (hoveredIndex < currentDraggedIndex) {
        if (index < currentDraggedIndex && index >= hoveredIndex) {
          return ITEM_HEIGHT;
        }
      }

      return 0;
    },
    (targetShift, previousShift) => {
      'worklet';
      // ONLY animate when target ACTUALLY changes - this prevents thrashing
      if (targetShift !== previousShift) {
        const duration = globalIsDragging.value ? 100 : 150;
        shiftY.value = withTiming(targetShift, { duration, easing: Easing.out(Easing.ease) });
      }
    },
    [index], // Dependencies - index is the only JS value used in the worklet
  );

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

  // End the settling period after cache update has time to complete
  // This is called via scheduleOnRN from onEnd
  const endSettlingDelayed = useCallback(() => {
    setTimeout(() => {
      isSettling.value = false;
      draggedIndex.value = -1;
      currentTranslateY.value = 0;
    }, 300); // Increased from 200ms to ensure all shift animations complete before state reset
  }, [isSettling, draggedIndex, currentTranslateY]);

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
          // Global drag state for shift animations (centralized)
          globalIsDragging.value = true;
          draggedIndex.value = index;
          currentTranslateY.value = 0;
          draggedScale.value = withSpring(DRAG_SCALE, { damping: 15, stiffness: 400 });
          // Pass function reference (not arrow function) - must be defined in RN Runtime scope
          scheduleOnRN(triggerLightHaptic);
        })
        .onUpdate((event) => {
          'worklet';
          // Local drag state for this item's position
          translateY.value = event.translationY;
          // Global drag state for shift calculations
          currentTranslateY.value = event.translationY;
        })
        .onEnd((event) => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          const finalY = event.translationY;
          // Don't reset translateY here - index change handler resets it
          // This prevents the snap-back flicker on drop

          // Start settling period - prevents shift animations during cache update
          // Don't clear draggedIndex yet - cache update needs to complete first
          globalIsDragging.value = false;
          isSettling.value = true;
          draggedScale.value = withSpring(1, { damping: 15, stiffness: 400 });

          // Pass function reference with argument - scheduleOnRN(fn, ...args) syntax
          scheduleOnRN(handleDragEnd, finalY);

          // End settling after cache update has time to complete
          scheduleOnRN(endSettlingDelayed);
        })
        .onFinalize(() => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          // Global drag state - full reset (onFinalize is for cancelled gestures, no reorder)
          globalIsDragging.value = false;
          isSettling.value = false;
          draggedIndex.value = -1;
          currentTranslateY.value = 0;
          draggedScale.value = 1;
        }),
    [isDragging, translateY, handleDragEnd, triggerLightHaptic, endSettlingDelayed, globalIsDragging, draggedIndex, currentTranslateY, draggedScale, isSettling, index],
  );

  // Animated style for drag offset with scale and shadow (for the dragged item)
  // Uses centralized draggedScale from context for consistent animation
  const dragAnimatedStyle = useAnimatedStyle(() => {
    const isThisItemDragged = draggedIndex.value === index;

    // Keep elevated if: actively dragging, OR settling after being dropped, OR has offset
    // This prevents overlap glitch where shifted items appear behind dropped item
    const wasJustDropped = isSettling.value && draggedIndex.value === index;
    const shouldBeElevated = isDragging.value || wasJustDropped || Math.abs(translateY.value) > 1;

    const shadowOpacity = interpolate(
      draggedScale.value,
      [1, DRAG_SCALE],
      [0.1, DRAG_SHADOW_OPACITY],
    );

    return {
      transform: [
        { translateY: translateY.value },
        { scale: isThisItemDragged ? draggedScale.value : 1 },
      ],
      // Keep elevated during settling to prevent overlap with shifting items
      zIndex: shouldBeElevated ? 999 : 0,
      shadowOpacity: isThisItemDragged ? shadowOpacity : 0.1,
      elevation: isDragging.value || wasJustDropped ? 12 : 4,
    };
  });

  // Animated style for shift animation (for non-dragged items)
  // When another item is being dragged, this item shifts up/down to make space
  // NOTE: shiftY is animated by useAnimatedReaction above - this just reads the value
  const shiftAnimatedStyle = useAnimatedStyle(() => {
    // If I'm the dragged item, don't apply shift (dragAnimatedStyle handles it)
    if (draggedIndex.value === index) {
      return {};
    }
    // Read from shiftY SharedValue which is animated by useAnimatedReaction
    return {
      transform: [{ translateY: shiftY.value }],
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
