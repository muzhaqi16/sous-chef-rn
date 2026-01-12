import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  useAnimatedRef,
  measure,
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
import { DRAG_ITEM_HEIGHT } from '#/constants/animations';

// Drag animation constants
const DRAG_SCALE = 1.03;
const DRAG_SHADOW_OPACITY = 0.25;
const ITEM_VERTICAL_MARGIN = 8; // marginVertical: spacing.xs = 4px each side

// Autoscroll constants
const EDGE_THRESHOLD = 80; // px from edge to trigger autoscroll
const MAX_SCROLL_SPEED = 10; // px per frame at max speed

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
  // - isDragging/draggedIndex/draggedItemId: identify which item is being dragged
  // - currentTranslateY: gesture offset for shift calculations
  // - draggedScale: scale animation (centralized, not per-item)
  // - scroll state: for autoscroll and viewport-aware calculations
  // - measuredItemHeight: dynamically measured height for accurate drag calculations
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    draggedItemId,
    currentTranslateY,
    draggedScale,
    scrollOffset,
    dragStartScrollOffset,
    contentHeight,
    visibleHeight,
    listTopY,
    dragUpdateTrigger,
    measuredItemHeight,
    isDropping,
    scrollToOffset,
  } = useDragState();

  // Animated ref for measuring item height on drag start
  const containerRef = useAnimatedRef<Animated.View>();

  // Handle index changes after cache updates (drop compensation)
  // useRecyclingState auto-resets prevIndex when item.id changes (view recycling)
  // useLayoutEffect runs synchronously before paint to prevent visual flash
  useLayoutEffect(() => {
    if (index !== prevIndex) {
      // Compensate for index change by adjusting translateY
      // This creates a smooth transition instead of a visual jump
      const indexDelta = index - prevIndex;
      const heightDelta = indexDelta * DRAG_ITEM_HEIGHT;

      // Check if this is the dragged item completing its drop
      const isTheDraggedItem = draggedItemId.value === item.id;

      // Compensate translateY for position change
      const compensatedY = translateY.value - heightDelta;

      if (isTheDraggedItem) {
        // Dragged item: Set compensated value immediately (cancels any pending fallback animation)
        // then animate smoothly to 0 from the compensated position
        translateY.value = compensatedY;
        translateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) }, (finished) => {
          'worklet';
          if (finished) {
            // Reset ALL global state here (including isDropping and globalIsDragging)
            // This happens AFTER the settle animation completes
            isDropping.value = false;
            globalIsDragging.value = false;
            draggedIndex.value = -1;
            draggedItemId.value = '';
            measuredItemHeight.value = 0;
            // Force final update to ensure all items see the reset
            dragUpdateTrigger.value = withTiming(dragUpdateTrigger.value + 1, { duration: 1 });
          }
        });
      } else if (Math.abs(translateY.value) > 1) {
        // Non-dragged item: just compensate without animation
        translateY.value = compensatedY;
      }

      // Reset shift instantly since item is now at new position
      if (Math.abs(shiftY.value) > 1) {
        shiftY.value = 0;
      }

      // Update tracked index
      setPrevIndex(index);
    }
    // SharedValues from context (draggedIndex, draggedItemId, etc.) are stable refs - don't need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, prevIndex, translateY, shiftY, setPrevIndex, item.id]);

  // Calculate target shift using useDerivedValue for better dependency tracking
  // useDerivedValue properly tracks SharedValue changes from Context (unlike useAnimatedReaction)
  const targetShiftY = useDerivedValue(() => {
    'worklet';
    // Force re-evaluation on every drag state change
    // Reanimated v4 has issues tracking SharedValue changes through Context
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dragUpdateTrigger.value;

    // During drop transition, freeze shift values - don't recalculate
    // This prevents items from collapsing back before React re-renders with new indices
    if (isDropping.value) {
      return shiftY.value; // Return current value unchanged
    }

    // Read ALL SharedValues - useDerivedValue tracks these automatically
    const currentDraggedIndex = draggedIndex.value;
    const isDraggingNow = globalIsDragging.value;
    const translateYNow = currentTranslateY.value;
    const currentDraggedItemId = draggedItemId.value;

    // If I'm the dragged item (check by ID for stable identity), no shift needed
    if (currentDraggedItemId === item.id) return 0;

    // If not dragging, reset to 0
    if (!isDraggingNow) return 0;

    // Use dynamically measured height + margins, or fall back to constant (which already includes margins)
    // measure() returns content height only, so we add ITEM_VERTICAL_MARGIN for proper spacing
    const itemHeight = measuredItemHeight.value > 0
      ? measuredItemHeight.value + ITEM_VERTICAL_MARGIN
      : DRAG_ITEM_HEIGHT;

    // Calculate effective translateY including scroll delta
    // When autoscrolling, the view scrolls but translateY stays the same
    // We need to account for how much the list has scrolled since drag started
    const scrollDelta = scrollOffset.value - dragStartScrollOffset.value;
    const effectiveTranslateY = translateYNow + scrollDelta;

    // Calculate which index the dragged item is hovering over
    // Add offset for early shift triggering (~28px instead of ~47px)
    // Offset pushes Math.round to trigger 20% earlier while keeping correct item height
    const offset = effectiveTranslateY > 0 ? 0.2 : (effectiveTranslateY < 0 ? -0.2 : 0);
    const hoveredIndex = currentDraggedIndex + Math.round(effectiveTranslateY / itemHeight + offset);

    // Moving DOWN: items between original and hovered positions shift UP
    if (hoveredIndex > currentDraggedIndex) {
      if (index > currentDraggedIndex && index <= hoveredIndex) {
        return -itemHeight;
      }
    }
    // Moving UP: items between hovered and original positions shift DOWN
    else if (hoveredIndex < currentDraggedIndex) {
      if (index < currentDraggedIndex && index >= hoveredIndex) {
        return itemHeight;
      }
    }

    return 0;
  }, [index, item.id]);

  // Animate shift when target changes - useAnimatedReaction triggers withTiming only on change
  useAnimatedReaction(
    () => targetShiftY.value,
    (target, prev) => {
      'worklet';
      if (target !== prev) {
        shiftY.value = withTiming(target, { duration: 100, easing: Easing.out(Easing.ease) });
      }
    },
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
  // Also handles animation and state reset based on whether position changed
  const handleDragEnd = useCallback((finalTranslateY: number) => {
    const { index: currentIndex, totalItems: total, itemId, onReorderByDelta: reorder } = dragContextRef.current;

    // Use dynamically measured height + margins, or fall back to constant (which already includes margins)
    const itemHeight = measuredItemHeight.value > 0
      ? measuredItemHeight.value + ITEM_VERTICAL_MARGIN
      : DRAG_ITEM_HEIGHT;

    // Calculate how many positions to move based on drag offset
    const positionDelta = Math.round(finalTranslateY / itemHeight);

    // Calculate if position actually changes
    const newIndex = Math.max(0, Math.min(total - 1, currentIndex + positionDelta));
    const positionChanged = reorder && positionDelta !== 0 && newIndex !== currentIndex;

    if (positionChanged) {
      // CASE 1: Position changes - call reorder, let useLayoutEffect handle everything
      // Cache updates synchronously in handleSortOrderUpdate (cache.modify + cache.writeQuery)
      isDropping.value = true; // Freeze shift values during drop transition
      HapticService.medium();
      reorder(itemId, positionDelta);

      // Reset translate values (won't affect shifts since isDropping is true)
      // useLayoutEffect will reset everything after the settle animation
      currentTranslateY.value = 0;
      dragStartScrollOffset.value = 0;
    } else {
      // CASE 2: Same position - just animate back and reset state
      translateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) }, (finished) => {
        'worklet';
        if (finished) {
          // Reset all global state
          globalIsDragging.value = false;
          draggedIndex.value = -1;
          draggedItemId.value = '';
          currentTranslateY.value = 0;
          dragStartScrollOffset.value = 0;
          measuredItemHeight.value = 0;
          dragUpdateTrigger.value = withTiming(dragUpdateTrigger.value + 1, { duration: 1 });
        }
      });
    }
  }, [measuredItemHeight, translateY, globalIsDragging, draggedIndex, draggedItemId, currentTranslateY, dragStartScrollOffset, dragUpdateTrigger, isDropping]);

  // Stable haptic callback for drag start - must be defined in RN Runtime scope
  // for scheduleOnRN to work correctly (cannot use arrow functions inside worklets)
  // @see https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN/
  const triggerLightHaptic = useCallback(() => {
    HapticService.light();
  }, []);

  // Pan gesture for drag-to-reorder (attached to drag handle only)
  // Using drag handle avoids gesture conflicts with Swipeable and TouchableOpacity
  // activateAfterLongPress requires holding the drag handle to start dragging
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(200) // Require 200ms long press to start drag
        .onStart(() => {
          'worklet';
          // Measure actual item height for accurate drag calculations
          const measured = measure(containerRef);
          if (measured) {
            measuredItemHeight.value = measured.height;
          }

          // Local drag state
          isDragging.value = true;
          // Global drag state for shift animations (centralized)
          globalIsDragging.value = true;
          draggedIndex.value = index;
          draggedItemId.value = item.id; // Track by ID for stable identity
          dragStartScrollOffset.value = scrollOffset.value; // Remember scroll position at drag start
          currentTranslateY.value = 0;
          draggedScale.value = withSpring(DRAG_SCALE, { damping: 15, stiffness: 400 });
          // CRITICAL: Use withTiming to force useDerivedValue re-evaluation
          // Direct assignment doesn't reliably trigger reactive worklets in Reanimated v4
          // See: https://github.com/software-mansion/react-native-reanimated/issues/7031
          dragUpdateTrigger.value = withTiming(
            dragUpdateTrigger.value + 1,
            { duration: 1 }
          );
          // Pass function reference (not arrow function) - must be defined in RN Runtime scope
          scheduleOnRN(triggerLightHaptic);
        })
        .onUpdate((event) => {
          'worklet';
          // Local drag state for this item's position
          translateY.value = event.translationY;
          // Global drag state for shift calculations
          currentTranslateY.value = event.translationY;
          // Force shift re-evaluation on every update
          // Use withTiming to reliably trigger useDerivedValue in Reanimated v4
          dragUpdateTrigger.value = withTiming(
            dragUpdateTrigger.value + 1,
            { duration: 1 }
          );

          // Autoscroll when dragging near edges of the FlashList viewport
          // Convert screen coordinates to list-relative coordinates
          const fingerInList = event.absoluteY - listTopY.value;
          const topEdge = EDGE_THRESHOLD;
          const bottomEdge = visibleHeight.value - EDGE_THRESHOLD;

          if (fingerInList < topEdge && scrollOffset.value > 0) {
            // Scroll up - finger is near top of list, faster closer to edge
            const speed = interpolate(fingerInList, [0, topEdge], [MAX_SCROLL_SPEED, 0], 'clamp');
            const newOffset = Math.max(0, scrollOffset.value - speed);
            scrollOffset.value = newOffset; // Update SharedValue for hover calculation
            scheduleOnRN(scrollToOffset, newOffset);
          } else if (fingerInList > bottomEdge) {
            // Scroll down - finger is near bottom of list
            const maxOffset = Math.max(0, contentHeight.value - visibleHeight.value);
            if (scrollOffset.value < maxOffset) {
              const speed = interpolate(fingerInList, [bottomEdge, visibleHeight.value], [0, MAX_SCROLL_SPEED], 'clamp');
              const newOffset = Math.min(maxOffset, scrollOffset.value + speed);
              scrollOffset.value = newOffset; // Update SharedValue for hover calculation
              scheduleOnRN(scrollToOffset, newOffset);
            }
          }
        })
        .onEnd((event) => {
          'worklet';
          // Local drag state
          isDragging.value = false;
          const finalY = event.translationY;

          // Scale back to normal
          draggedScale.value = withSpring(1, { damping: 15, stiffness: 400 });

          // Call reorder callback on JS thread - cache updates synchronously there
          // handleDragEnd will handle animation and state reset based on whether position changed
          scheduleOnRN(handleDragEnd, finalY);

          // DON'T animate translateY here - handleDragEnd/useLayoutEffect handle it
          // DON'T reset global state here - handleDragEnd does it after cache update
        })
        .onFinalize((_event, success) => {
          'worklet';
          // onFinalize is called after EVERY gesture end (success or cancel)
          // Only do full reset if gesture was CANCELLED (success = false)
          // For successful gestures, onEnd already handled the state properly
          if (!success) {
            // Local drag state
            isDragging.value = false;
            translateY.value = withTiming(0, { duration: 150 });
            // Global drag state - full reset
            isDropping.value = false;
            globalIsDragging.value = false;
            draggedIndex.value = -1;
            draggedItemId.value = '';
            currentTranslateY.value = 0;
            draggedScale.value = 1;
            dragStartScrollOffset.value = 0;
            measuredItemHeight.value = 0;
          }
        }),
    [isDragging, translateY, handleDragEnd, triggerLightHaptic, globalIsDragging, draggedIndex, draggedItemId, dragStartScrollOffset, currentTranslateY, draggedScale, dragUpdateTrigger, measuredItemHeight, isDropping, containerRef, scrollOffset, contentHeight, visibleHeight, listTopY, scrollToOffset, index, item.id],
  );

  // Animated style for drag offset with scale and shadow
  // CRITICAL: This style handles BOTH dragged item positioning AND non-dragged item shifts
  // We must merge transforms into a single style because React Native doesn't merge transform arrays
  // (when multiple styles have transforms, the last one wins and overwrites the others)
  const dragAnimatedStyle = useAnimatedStyle(() => {
    // Use ID-based check for stable identity across FlashList recycling
    const isThisItemDragged = draggedItemId.value === item.id;

    // Keep elevated if: actively dragging OR has offset (animating back)
    const shouldBeElevated = isDragging.value || Math.abs(translateY.value) > 1;

    const shadowOpacity = interpolate(
      draggedScale.value,
      [1, DRAG_SCALE],
      [0.1, DRAG_SHADOW_OPACITY],
    );

    // CRITICAL FIX: Use drag translateY for dragged item, shift translateY for non-dragged items
    // This merges both transforms into one array to prevent override
    const yOffset = isThisItemDragged ? translateY.value : shiftY.value;

    return {
      transform: [
        { translateY: yOffset },
        { scale: isThisItemDragged ? draggedScale.value : 1 },
      ],
      zIndex: shouldBeElevated ? 999 : 0,
      shadowOpacity: isThisItemDragged ? shadowOpacity : 0.1,
      elevation: isDragging.value ? 12 : 4,
    };
  });

  // Note: shiftAnimatedStyle hook removed - shift transform now merged into dragAnimatedStyle
  // to prevent React Native's transform array override behavior (last transform array wins)

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
    // Slide right when marking as purchased (not currently purchased)
    // Slide left when unmarking (currently purchased)
    const direction = item.isPurchased ? -1 : 1;
    triggerExit(direction, () => {
      // Prepare FlashList for layout change RIGHT BEFORE data changes
      // This timing is critical - FlashList needs a fresh layout snapshot
      // immediately before the re-render, not 300ms earlier
      // @see https://shopify.github.io/flash-list/docs/guides/layout-animation
      prepareForLayoutAnimation?.();
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
      ref={containerRef}
      style={[
        styles.container,
        exitAnimatedStyle,
        entryAnimatedStyle,
        // Note: shiftAnimatedStyle removed - shift transform now merged into dragAnimatedStyle
        // to prevent React Native's transform array override behavior
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
