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
  // Track drag state
  const [_isDragging, setIsDragging] = useState(false);
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Update local items when props change, but not during our own updates
  useEffect(() => {
    if (!isUpdatingRef.current) {
      // Check if the items actually changed (not just re-sorted)
      // This prevents flickering when sortOrder updates from server
      const currentIds = localItems.map(item => item.id).join(',');
      const newIds = items.map(item => item.id).join(',');

      // Only update if items were added/removed
      if (currentIds !== newIds) {
        setLocalItems(items);
      }
    }
  }, [items]); // Removed localItems from deps to prevent unnecessary re-runs

  // Check if the order of items has changed
  const hasOrderChanged = useCallback(
    (
      originalItems: SortableShoppingListItem[],
      newItems: SortableShoppingListItem[],
    ): boolean => {
      if (originalItems.length !== newItems.length) return true;

      return originalItems.some(
        (item, index) => item.id !== newItems[index].id,
      );
    },
    [],
  );

  // Handle drag end - called when user releases item
  const handleDragEnd = useCallback(
    async (data: SortableShoppingListItem[]) => {
      setIsDragging(false);

      if (disabled || !onSortOrderUpdate) {
        setLocalItems(data);
        return;
      }

      // Check if order actually changed - skip API call if no change
      if (!hasOrderChanged(items, data)) {
        console.log('✓ Drag ended - order unchanged, skipping API call');
        return;
      }

      // Update local state optimistically
      setLocalItems(data);
      isUpdatingRef.current = true;

      try {
        // Find which item was moved by comparing positions
        let movedItemId: string | null = null;
        let newIndex = -1;

        for (let i = 0; i < data.length; i++) {
          if (items[i]?.id !== data[i]?.id) {
            // Found the item that moved
            movedItemId = data[i].id;
            newIndex = i;
            break;
          }
        }

        if (!movedItemId || newIndex === -1) {
          // Fallback: check from end of array
          for (let i = data.length - 1; i >= 0; i--) {
            if (items[i]?.id !== data[i]?.id) {
              movedItemId = data[i].id;
              newIndex = i;
              break;
            }
          }
        }

        if (!movedItemId || newIndex === -1) {
          console.warn('Could not determine which item was moved');
          isUpdatingRef.current = false;
          return;
        }

        // Calculate afterItemId and beforeItemId based on new position
        const afterItemId = newIndex > 0 ? data[newIndex - 1].id : null;
        const beforeItemId =
          newIndex < data.length - 1 ? data[newIndex + 1].id : null;

        console.log('Moving item:', {
          itemId: movedItemId,
          newIndex,
          afterItemId,
          beforeItemId,
        });

        // Wait for the mutation to complete and server to respond
        await onSortOrderUpdate(movedItemId, afterItemId, beforeItemId);

        // Release the lock - local order will persist until items are added/removed
        // The useEffect will only sync when IDs change (items added/removed), not when order changes
        isUpdatingRef.current = false;
        console.log('✓ Sort order updated on server');
      } catch (error) {
        console.error('Failed to update sort order:', error);
        // Revert to original order on error
        setLocalItems(items);
        isUpdatingRef.current = false;
      }
    },
    [disabled, onSortOrderUpdate, items, hasOrderChanged],
  );

  const handleDragBegin = useCallback(() => {
    setIsDragging(true);
  }, []);

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
        onDragBegin={handleDragBegin}
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
