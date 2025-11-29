import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
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
import { useRenderTime, useProgressiveList } from '#hooks/performance';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

export const SortableShoppingList: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onSortOrderUpdate,
  disabled = false,
  ListFooterComponent,
  onSwipeableWillOpen: externalOnSwipeableWillOpen,
  onRefresh: _onRefresh,
  refreshing: _refreshing,
  onDragBegin: externalOnDragBegin,
  onDragRelease: externalOnDragRelease,
  isDragging = false,
  ...flatListProps
}) => {
  // Track render performance
  useRenderTime('SortableShoppingList');

  // Track local order for optimistic updates
  const [localItems, setLocalItems] = useState(items);

  // PERFORMANCE: Progressive rendering - spread item initialization across multiple frames
  // Each item creates ~8-10 Reanimated shared values + gesture handlers
  // Rendering all at once blocks JS thread for 4-5 seconds
  // Progressive loading renders 6 items, yields, renders 3 more, etc.
  const progressiveItems = useProgressiveList(localItems, {
    initialBatch: 6, // Show 6 items immediately (fills viewport)
    batchSize: 3, // Add 3 items per batch after initial
    batchDelay: 32, // ~2 frames at 60fps - gives time for animations
  });
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);
  // Track currently open swipeable item (only used if no external handler provided)
  const openSwipeableRef = useRef<any>(null);
  // Track latest items prop to avoid stale closure in callbacks
  const itemsRef = useRef(items);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Keep itemsRef in sync with latest items prop
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // PERFORMANCE: Simplified sync - just check reference change
  // Apollo's normalized cache provides stable item references
  // When items truly change (add/remove/edit/reorder), Apollo returns new array reference
  // During drag operations, isUpdatingRef prevents overwriting our optimistic update
  useEffect(() => {
    if (!isUpdatingRef.current) {
      setLocalItems(items);
    }
  }, [items]);

  // Drag gesture callbacks - gate RefreshControl during drag
  // Per GitHub issues #135, #189, #467: RefreshControl conflicts with drag gesture
  // Solution: Conditionally remove RefreshControl from tree during drag
  // Note: DraggableFlatList manages scrollEnabled internally (sets scrollEnabled={!activeKey})
  // Manual setNativeProps can leave scroll stuck if drag aborts - let library handle it
  const handleDragBegin = useCallback(() => {
    if (__DEV__) console.log('📱 DraggableFlatList: Drag BEGIN');
    externalOnDragBegin?.();
  }, [externalOnDragBegin]);

  const handleDragRelease = useCallback(() => {
    if (__DEV__) console.log('📱 DraggableFlatList: Drag RELEASE');
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

  // Handle drag end - called when user releases item
  const handleDragEnd = useCallback(
    async (data: SortableShoppingListItem[]) => {
      if (disabled || !onSortOrderUpdate) {
        setLocalItems(data);
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

      // Update local state optimistically
      setLocalItems(data);
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

  // Number of items to render initially (fills viewport)
  const INITIAL_NUM_TO_RENDER = 6;

  // Render item with ScaleDecorator for drag feedback
  // PERFORMANCE: Only wrap in ScaleDecorator when actively dragging
  // This reduces Reanimated shared value creation from 300+ to ~18 on initial render
  const renderItem = useCallback(
    ({
      item,
      drag,
      isActive,
    }: RenderItemParams<SortableShoppingListItem>) => {
      const itemComponent = (
        <SimpleDraggableItem
          item={item}
          onItemPress={onItemPress}
          onItemEdit={onItemEdit}
          onItemDelete={onItemDelete}
          onTogglePurchase={onTogglePurchase}
          drag={disabled ? undefined : drag}
          isActive={isActive}
          onSwipeableWillOpen={handleSwipeableWillOpen}
          onSwipeableClose={handleSwipeableClose}
        />
      );

      // Only apply ScaleDecorator when actively dragging to reduce Reanimated overhead
      if (isActive) {
        return <ScaleDecorator>{itemComponent}</ScaleDecorator>;
      }
      return itemComponent;
    },
    [
      onItemPress,
      onItemEdit,
      onItemDelete,
      onTogglePurchase,
      disabled,
      handleSwipeableWillOpen,
      handleSwipeableClose,
    ],
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
    <View style={styles.container}>
      <DraggableFlatList
        data={progressiveItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        getItemLayout={(_, index) => ({
          length: 103, // 87px item height + 16px margin (8px top + 8px bottom)
          offset: 103 * index,
          index,
        })}
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
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
        }}
        ListFooterComponent={ListFooterComponent}
        // NOTE: RefreshControl disabled due to fundamental gesture conflicts
        // All approaches attempted (RNGH, native, ScrollView wrapper, NestableScrollContainer)
        // Either break normal scroll or cause VirtualizedList nesting warnings
        // Alternative: Add manual refresh button to tab bar or header
        // PERFORMANCE: Render enough items to fill viewport above fold
        // Each item creates ~5 Reanimated shared values + gesture handlers
        initialNumToRender={INITIAL_NUM_TO_RENDER} // Fill viewport to avoid visible pop-in
        maxToRenderPerBatch={2} // Smaller batches to avoid blocking JS thread
        windowSize={3} // Tighter window (3 viewports) to reduce off-screen rendering
        updateCellsBatchingPeriod={50} // Batch cell updates for smoother animations
        removeClippedSubviews={true} // Reduce memory on large lists
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
