import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import type {
  SortableShoppingListProps,
  SortableShoppingListItem,
} from './types';
import { SimpleDraggableItem } from './SortableItem';
import {
  hasOrderChanged,
  findMovedItem,
  getNeighborIds,
} from './SortableList.utils';
import { useProgressiveList } from '#hooks/performance';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions,
} from './SortableListActionsContext';
import {
  SortableListThemeContext,
  type SortableListThemeColors,
} from './SortableListThemeContext';
import { listItemLayoutAnimation } from '#/constants/animations';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

// PERF DIAGNOSTICS: Constants for performance tracking
const ITEM_HEIGHT = 103; // 87px item + 16px margin
const SCREEN_HEIGHT = Dimensions.get('window').height;
const EXPECTED_VISIBLE_ITEMS = Math.ceil(SCREEN_HEIGHT / ITEM_HEIGHT);

const SortableShoppingListComponent: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onSortOrderUpdate,
  disabled = false,
  ListFooterComponent,
  onSwipeableWillOpen: externalOnSwipeableWillOpen,
  onRefresh: _onRefresh,
  refreshing: _refreshing,
  onDragBegin: externalOnDragBegin,
  onDragRelease: externalOnDragRelease,
  isDragging = false,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  ...flatListProps
}) => {
  // Track local order for optimistic updates
  const [localItems, setLocalItems] = useState(items);

  // PERFORMANCE: Single useUnistyles call for entire list
  // Theme colors are passed via context to all child components
  // This eliminates 7-8 useUnistyles calls per item (major bottleneck)
  const { theme } = useUnistyles();
  const themeColors = useMemo<SortableListThemeColors>(
    () => ({
      primary: theme.colors.primary,
      textPrimary: theme.colors.textPrimary,
      textSecondary: theme.colors.textSecondary,
      surfaceVariant: theme.colors.surfaceVariant,
      surface: theme.colors.surface,
      border: theme.colors.border,
    }),
    [
      theme.colors.primary,
      theme.colors.textPrimary,
      theme.colors.textSecondary,
      theme.colors.surfaceVariant,
      theme.colors.surface,
      theme.colors.border,
    ],
  );

  // PERFORMANCE: Progressive rendering - spread item initialization across multiple frames
  // Each item creates ~8-10 Reanimated shared values + gesture handlers
  // Rendering all at once blocks JS thread for 4-5 seconds
  // Progressive loading renders items in batches, yields, then continues
  // TUNED v3: Reduced batch sizes to spread CPU load and allow UI thread to breathe
  const progressiveItems = useProgressiveList(localItems, {
    initialBatch: 8, // Fill viewport only (~8-9 items visible) to reduce initial blocking
    batchSize: 4, // Smaller batches yield more often to UI thread
    batchDelay: 16, // ~1 frame between batches for smoother rendering
    enabled: true, // Enable progressive rendering to reduce JS thread blocking
  });
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);
  // Track currently open swipeable item (only used if no external handler provided)
  const openSwipeableRef = useRef<any>(null);
  // Track latest items prop to avoid stale closure in callbacks
  const itemsRef = useRef(items);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // PERF DIAGNOSTICS: Track component mount time and scroll metrics
  const mountTimeRef = useRef(Date.now());
  const lastScrollLogRef = useRef(0);
  const blankCellCountRef = useRef(0);
  const scrollFrameCountRef = useRef(0);

  // PERF DIAGNOSTICS: Log mount completion time
  useEffect(() => {
    if (__DEV__) {
      const mountDuration = Date.now() - mountTimeRef.current;
      console.log(`[PERF] Mount: ${mountDuration}ms, ${items.length} items`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount
  }, []);

  // Keep itemsRef in sync with latest items prop
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Track previous items length for layout animation
  const prevItemsLengthRef = useRef(items.length);
  // Track if we recently finished dragging to prevent LayoutAnimation flicker
  const recentDragRef = useRef(false);

  // PERFORMANCE: Simplified sync - just check reference change
  // Apollo's normalized cache provides stable item references
  // When items truly change (add/remove/edit/reorder), Apollo returns new array reference
  // During drag operations, both refs prevent overwriting our optimistic update
  useEffect(() => {
    // Skip sync during drag operations OR while updating sort order
    // This prevents the items prop from overwriting our optimistic drag reorder
    if (isUpdatingRef.current || recentDragRef.current) {
      return;
    }

    prevItemsLengthRef.current = items.length;
    setLocalItems(items);
    // Note: LayoutAnimation is now configured by useItemExitAnimation
    // before the mutation fires, ensuring smooth transitions
  }, [items]);

  // Drag gesture callbacks - gate RefreshControl during drag
  // Per GitHub issues #135, #189, #467: RefreshControl conflicts with drag gesture
  // Solution: Conditionally remove RefreshControl from tree during drag
  // Note: DraggableFlatList manages scrollEnabled internally (sets scrollEnabled={!activeKey})
  // Manual setNativeProps can leave scroll stuck if drag aborts - let library handle it
  const handleDragBegin = useCallback(() => {
    if (__DEV__) console.log('📱 DraggableFlatList: Drag BEGIN');
    recentDragRef.current = true;
    externalOnDragBegin?.();
  }, [externalOnDragBegin]);

  const handleDragRelease = useCallback(() => {
    if (__DEV__) console.log('📱 DraggableFlatList: Drag RELEASE');
    // Keep recentDragRef true briefly to prevent LayoutAnimation flicker
    // Reset after cache updates have settled
    setTimeout(() => {
      recentDragRef.current = false;
    }, 500);
    externalOnDragRelease?.();
  }, [externalOnDragRelease]);

  // Handle swipeable item opening - close previously open item
  const handleSwipeableWillOpen = useCallback(
    (ref: any) => {
      // If external handler provided, use it (for coordinating across multiple lists)
      if (externalOnSwipeableWillOpen) {
        externalOnSwipeableWillOpen(ref);
      } else {
        // Otherwise, handle locally within this list
        if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
          // Close the previously open swipeable
          openSwipeableRef.current.current?.close();
        }
        // Update to track the newly opening swipeable
        openSwipeableRef.current = ref;
      }
    },
    [externalOnSwipeableWillOpen],
  );

  // Handle swipeable item closing
  const handleSwipeableClose = useCallback(() => {
    // No-op: swipe state tracking removed to prevent first-swipe re-render issue
  }, []);

  // PERFORMANCE: Memoize actions object for context provider
  // This object reference changes rarely, only when prop functions change
  const actions = useMemo<SortableListActions>(
    () => ({
      onItemPress,
      onItemEdit,
      onItemDelete,
      onTogglePurchase,
      onMoveToPantry,
      onQuantityPress,
      onSwipeableWillOpen: handleSwipeableWillOpen,
      onSwipeableClose: handleSwipeableClose,
    }),
    [
      onItemPress,
      onItemEdit,
      onItemDelete,
      onTogglePurchase,
      onMoveToPantry,
      onQuantityPress,
      handleSwipeableWillOpen,
      handleSwipeableClose,
    ],
  );

  // PERFORMANCE: Memoize permissions object for context provider
  const permissions = useMemo<SortableListPermissions>(
    () => ({
      canRemoveItems,
      canEditItems,
      canMarkPurchased,
      disabled,
    }),
    [canRemoveItems, canEditItems, canMarkPurchased, disabled],
  );

  // Handle drag end - called when user releases item
  const handleDragEnd = useCallback(
    async (data: SortableShoppingListItem[]) => {
      // Delay state update by one animation frame to allow library's heldTranslate
      // mechanism to clear. The library holds the last transform value until onLayout,
      // but our immediate state update was causing a timing conflict.
      requestAnimationFrame(() => {
        setLocalItems(data);
      });

      if (disabled || !onSortOrderUpdate) {
        return;
      }

      // Use latest items from ref to avoid stale closure
      const currentItems = itemsRef.current;

      // Check if order actually changed - skip API call if no change
      if (!hasOrderChanged(currentItems, data)) {
        if (__DEV__) {
          console.log('✓ Drag ended - order unchanged, skipping API call');
        }
        return;
      }

      // Lock to prevent items prop from overwriting our update
      isUpdatingRef.current = true;

      try {
        // Find which item was moved by comparing positions
        const movedItemInfo = findMovedItem(currentItems, data);

        if (!movedItemInfo) {
          if (__DEV__) {
            console.warn('Could not determine which item was moved');
          }
          isUpdatingRef.current = false;
          return;
        }

        const { itemId: movedItemId, newIndex } = movedItemInfo;

        // Calculate afterItemId/beforeItemId and their sortOrder values based on new position
        const {
          afterId: afterItemId,
          afterSortOrder,
          beforeId: beforeItemId,
          beforeSortOrder,
        } = getNeighborIds(data, newIndex);

        if (__DEV__) {
          console.log('Moving item:', {
            itemId: movedItemId,
            newIndex,
            afterItemId,
            afterSortOrder,
            beforeItemId,
            beforeSortOrder,
          });
        }

        // Mark item as reordered IMMEDIATELY (before mutation fires)
        // This ensures subscription filtering works during the await period
        // The 200ms window covers the mutation completion time
        SubscriptionService.getInstance().markItemReordered(movedItemId);

        // Wait for mutation to complete before releasing lock
        // This prevents subscription from overwriting optimistic update
        // Optimistic update already applied (line 147) so UI is instant
        await onSortOrderUpdate(
          movedItemId,
          afterItemId,
          beforeItemId,
          afterSortOrder,
          beforeSortOrder,
        );

        // Release lock AFTER mutation completes
        // This ensures subscription updates don't interfere with our optimistic update
        isUpdatingRef.current = false;

        if (__DEV__) {
          console.log('✓ Sort order updated on server');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to update sort order:', error);
        }
        // Revert to original order on error
        setLocalItems(currentItems);
        isUpdatingRef.current = false;
      }
    },
    [disabled, onSortOrderUpdate],
  );

  // PERF DIAGNOSTICS: Track viewable items to detect blank cells during scroll
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: SortableShoppingListItem }> }) => {
    if (!__DEV__) return;

    const visibleCount = viewableItems.length;
    const totalItems = progressiveItems.length;

    // Only log every 500ms to avoid spam
    const now = Date.now();
    if (now - lastScrollLogRef.current > 500) {
      lastScrollLogRef.current = now;

      // Detect blank cells (less than 80% of expected visible items)
      if (totalItems > EXPECTED_VISIBLE_ITEMS && visibleCount < EXPECTED_VISIBLE_ITEMS * 0.8) {
        blankCellCountRef.current++;
        console.log(`[PERF] Blank cells: ${visibleCount}/${EXPECTED_VISIBLE_ITEMS}`);
      }

      // Log scroll performance periodically
      scrollFrameCountRef.current++;
      if (scrollFrameCountRef.current % 10 === 0) {
        console.log(`[PERF] Scroll: ${visibleCount} visible, ${blankCellCountRef.current} blanks`);
      }
    }
  }, [progressiveItems.length]);

  // PERFORMANCE: Simplified renderItem - actions come from context
  // Empty dependency array = callback never recreates = no cascade re-renders
  // ScaleDecorator provides visual feedback during drag
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<SortableShoppingListItem>) => (
      <ScaleDecorator activeScale={isActive ? 1.03 : 1}>
        <SimpleDraggableItem
          item={item}
          drag={disabled ? undefined : drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    ),
    [disabled],
  );

  // Early validation
  if (!items || !Array.isArray(items)) {
    console.warn('SortableList: items is not a valid array', items);
    return null;
  }

  if (items.length === 0) {
    // If there's a footer (e.g., purchased items section), still render it
    // This allows the CollapsiblePurchasedSection to display when all items are purchased
    if (ListFooterComponent) {
      return (
        <View style={styles.container}>
          {React.isValidElement(ListFooterComponent)
            ? ListFooterComponent
            : React.createElement(ListFooterComponent as React.ComponentType)}
        </View>
      );
    }
    return null;
  }

  /**
   * Gesture Coordination Strategy (following react-native-draggable-flatlist best practices):
   *
   * - Scroll: Automatic (DraggableFlatList manages scrollEnabled internally)
   * - Swipe (horizontal): Automatic (ReanimatedSwipeable in SwipeableItem)
   * - Pull-to-Refresh: Conditionally rendered (RNGH RefreshControl)
   * - Drag (vertical): Manual activation via onLongPress on DragHandle
   *
   * activationDistance: Uses library default (0) - no threshold needed for manual drag.
   * When using manual drag activation via onLongPress, activationDistance is unnecessary.
   * The drag() function is called explicitly, bypassing gesture detection entirely.
   * Setting activationDistance > 0 creates a dead zone that BLOCKS normal scroll gestures.
   * Per official examples: manual drag handles work with activationDistance={0} (default).
   *
   * RefreshControl Conflict Prevention (per GitHub issues #135, #189, #467):
   * - Known issue: PanGestureHandler wrapping FlatList conflicts with RefreshControl
   * - Solution: Conditionally remove RefreshControl from tree during drag
   * - isDraggingLocally state tracks drag operation (set in onDragBegin/onDragRelease)
   * - RefreshControl only rendered when !isDraggingLocally
   * - This completely eliminates gesture conflict during drag operations
   *
   * Note: DraggableFlatList manages scrollEnabled internally (sets scrollEnabled={!activeKey})
   * Manual setNativeProps({ scrollEnabled }) can leave scroll stuck if drag aborts - avoid it.
   */
  return (
    <SortableListThemeContext.Provider value={themeColors}>
      <SortableListActionsProvider actions={actions} permissions={permissions}>
        <View style={styles.container}>
          <DraggableFlatList
          data={progressiveItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          itemLayoutAnimation={listItemLayoutAnimation}
          getItemLayout={(_, index) => ({
            length: 103, // 87px item height + 16px margin (8px top + 8px bottom)
            offset: 103 * index,
            index,
          })}
          // Very fast spring animation to minimize flicker on drop
          // High stiffness + high damping = nearly instant transition
          animationConfig={{
            damping: 50,
            stiffness: 500,
          }}
          activationDistance={isDragging ? 1 : 20}
          onDragBegin={handleDragBegin}
          onDragEnd={({ data }) => {
            handleDragRelease();
            handleDragEnd(data);
          }}
          onRelease={handleDragRelease}
          showsVerticalScrollIndicator={
            flatListProps.showsVerticalScrollIndicator ?? true
          }
          contentContainerStyle={{
            paddingTop: 8, // Match item's marginVertical for consistent spacing from tabs
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
          }}
          ListFooterComponent={ListFooterComponent}
          // NOTE: RefreshControl disabled due to fundamental gesture conflicts
          // All approaches attempted (RNGH, native, ScrollView wrapper, NestableScrollContainer)
          // Either break normal scroll or cause VirtualizedList nesting warnings
          // Alternative: Add manual refresh button to tab bar or header
          // PERFORMANCE: Optimized for smooth scrolling
          // Trade-off: Higher memory usage for smoother scroll experience
          // TUNED v3: Reduced values to match smaller initial batch and spread CPU load
          initialNumToRender={10} // Match progressive batch - fill viewport only
          maxToRenderPerBatch={6} // Smaller batches yield to UI thread more often
          windowSize={5} // Reduced buffer - loads remaining items progressively
          updateCellsBatchingPeriod={50} // More batching = less frequent updates
          removeClippedSubviews={true} // Reduce memory on large lists
          // PERF DIAGNOSTICS: Track visible items to detect blank cells
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          />
        </View>
      </SortableListActionsProvider>
    </SortableListThemeContext.Provider>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));

// PERFORMANCE: Custom comparator for React.memo
// Only re-render when items actually change or essential props change
// Callbacks should be stable (from useCallback/refs) so don't compare them
const arePropsEqual = (
  prev: SortableShoppingListProps,
  next: SortableShoppingListProps,
): boolean => {
  // Fast path: same items reference = definitely equal for items
  if (
    prev.items === next.items &&
    prev.disabled === next.disabled &&
    prev.isDragging === next.isDragging
  ) {
    return true;
  }

  // If items reference changed, check if content actually changed
  if (prev.items !== next.items) {
    // Different length = definitely changed
    if (prev.items.length !== next.items.length) {
      return false;
    }

    // Check each item by id and key properties
    for (let i = 0; i < prev.items.length; i++) {
      const prevItem = prev.items[i];
      const nextItem = next.items[i];
      if (
        prevItem.id !== nextItem.id ||
        prevItem.isPurchased !== nextItem.isPurchased ||
        prevItem.sortOrder !== nextItem.sortOrder ||
        prevItem.title !== nextItem.title ||
        prevItem.rightElementConfig !== nextItem.rightElementConfig ||
        prevItem.leftElementConfig !== nextItem.leftElementConfig
      ) {
        return false;
      }
    }
  }

  // Check scalar props
  return (
    prev.disabled === next.disabled &&
    prev.isDragging === next.isDragging
  );
};

// Export memoized component
export const SortableShoppingList = React.memo(
  SortableShoppingListComponent,
  arePropsEqual,
);
