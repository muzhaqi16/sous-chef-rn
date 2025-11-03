import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';
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
  ...flatListProps
}) => {
  // Track local order for optimistic updates
  const [localItems, setLocalItems] = useState(items);
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);
  // Track currently open swipeable item (only used if no external handler provided)
  const openSwipeableRef = useRef<any>(null);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Update local items when props change, but not during our own updates
  useEffect(() => {
    if (!isUpdatingRef.current) {
      // Always update localItems when items prop changes
      // This ensures item property updates (like quantity) are reflected in the UI
      setLocalItems(items);
    }
  }, [items]);

  // Handle swipeable item opening - close previously open item
  const handleSwipeableWillOpen = useCallback((ref: any) => {
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
  }, [externalOnSwipeableWillOpen]);

  // Handle drag end - called when user releases item
  const handleDragEnd = useCallback(
    async (data: SortableShoppingListItem[]) => {
      if (disabled || !onSortOrderUpdate) {
        setLocalItems(data);
        return;
      }

      // Check if order actually changed - skip API call if no change
      if (!hasOrderChanged(items, data)) {
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
        const movedItemInfo = findMovedItem(items, data);

        if (!movedItemInfo) {
          if (__DEV__) {
            console.warn('Could not determine which item was moved');
          }
          isUpdatingRef.current = false;
          return;
        }

        const { itemId: movedItemId, newIndex } = movedItemInfo;

        // Calculate afterItemId and beforeItemId based on new position
        const { afterId: afterItemId, beforeId: beforeItemId } = getNeighborIds(data, newIndex);

        if (__DEV__) {
          console.log('Moving item:', {
            itemId: movedItemId,
            newIndex,
            afterItemId,
            beforeItemId,
          });
        }

        // Wait for the mutation to complete and server to respond
        await onSortOrderUpdate(movedItemId, afterItemId, beforeItemId);

        // Release the lock - local order will persist until items are added/removed
        // The useEffect will only sync when IDs change (items added/removed), not when order changes
        isUpdatingRef.current = false;

        if (__DEV__) {
          console.log('✓ Sort order updated on server');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to update sort order:', error);
        }
        // Revert to original order on error
        setLocalItems(items);
        isUpdatingRef.current = false;
      }
    },
    [disabled, onSortOrderUpdate, items],
  );

  // Render item with ScaleDecorator for drag feedback
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<SortableShoppingListItem>) => {
      return (
        <ScaleDecorator>
          <SimpleDraggableItem
            key={`${item.id}-${item.isPurchased ? 'purchased' : 'unpurchased'}`}
            item={item}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            drag={disabled ? undefined : drag}
            isActive={isActive}
            onSwipeableWillOpen={handleSwipeableWillOpen}
          />
        </ScaleDecorator>
      );
    },
    [onItemPress, onItemEdit, onItemDelete, onTogglePurchase, disabled, handleSwipeableWillOpen],
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

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={localItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        onDragEnd={({ data }) => handleDragEnd(data)}
        showsVerticalScrollIndicator={
          flatListProps.showsVerticalScrollIndicator ?? true
        }
        contentContainerStyle={{
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
        }}
        activationDistance={
          disabled ? 999999 : Platform.OS === 'android' ? 10 : 5
        }
        ListFooterComponent={ListFooterComponent}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
