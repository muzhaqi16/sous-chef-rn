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
import { useRenderTime } from '#hooks/performance';
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

  // Update local items when props change, but not during our own updates
  // OPTIMIZATION: Sync on structural changes (add/remove/reorder) or data changes (quantity)
  useEffect(() => {
    if (!isUpdatingRef.current) {
      // Check for structural changes: items added, removed, or reordered
      const hasStructuralChange =
        localItems.length !== items.length ||
        localItems.some((item, idx) => item.id !== items[idx]?.id);

      // Check for data changes in quantity or other important fields
      const hasDataChange = localItems.some((localItem, idx) => {
        const newItem = items[idx];
        if (!newItem || localItem.id !== newItem.id) return false;

        // Check quantity changes
        const quantityChanged =
          localItem.rightElementConfig?.quantity !==
          newItem.rightElementConfig?.quantity;

        // Check purchased status changes
        const purchasedChanged = localItem.isPurchased !== newItem.isPurchased;

        return quantityChanged || purchasedChanged;
      });

      if (hasStructuralChange || hasDataChange) {
        setLocalItems(items);
      }
    }
  }, [items, localItems]);

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

  // Render item with ScaleDecorator for drag feedback
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<SortableShoppingListItem>) => {
      return (
        <ScaleDecorator>
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
        </ScaleDecorator>
      );
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
        data={localItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
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
        // NOTE: RefreshControl disabled due to gesture conflicts with DraggableFlatList + TabView
        // Pull-to-refresh is incompatible with the gesture coordination required for:
        // - Normal vertical scroll
        // - Horizontal tab swipe
        // - Drag-to-reorder
        // OPTIMIZATION: Performance props to reduce initial render work
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={false}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
