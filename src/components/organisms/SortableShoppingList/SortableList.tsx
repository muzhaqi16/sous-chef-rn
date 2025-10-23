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
  ...flatListProps
}) => {
  // Track local order for optimistic updates
  const [localItems, setLocalItems] = useState(items);
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);
  // Track previous item IDs to detect add/remove operations
  const prevItemIdsRef = useRef<string>('');

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Update local items when props change, but not during our own updates
  useEffect(() => {
    if (!isUpdatingRef.current) {
      // Check if the items actually changed (not just re-sorted)
      // This prevents flickering when sortOrder updates from server
      const currentIds = prevItemIdsRef.current;
      const newIds = items.map(item => item.id).join(',');

      // Only update if items were added/removed
      if (currentIds !== newIds) {
        setLocalItems(items);
        prevItemIdsRef.current = newIds;
      }
    }
  }, [items]);

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
          />
        </ScaleDecorator>
      );
    },
    [onItemPress, onItemEdit, onItemDelete, onTogglePurchase, disabled],
  );

  // Early validation
  if (!items || !Array.isArray(items)) {
    console.warn('SortableList: items is not a valid array', items);
    return null;
  }

  if (items.length === 0) {
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
