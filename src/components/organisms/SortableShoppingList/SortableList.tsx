import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import type {
  SortableShoppingListProps,
  SortOrderUpdate,
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
  onSortOrderUpdate,
  onRefresh,
  refreshing = false,
  disabled = false,
  ...flatListProps
}) => {
  // Track local order for optimistic updates
  const [localItems, setLocalItems] = useState(items);
  // Track drag state to disable refresh
  const [isDragging, setIsDragging] = useState(false);
  // Track if we're currently updating the sort order
  const isUpdatingRef = useRef(false);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Update local items when props change, but not during our own updates
  useEffect(() => {
    if (!isUpdatingRef.current) {
      setLocalItems(items);
    }
  }, [items]);

  // Handle drag end - called when user releases item
  const handleDragEnd = useCallback(
    async (data: SortableShoppingListItem[]) => {
      setIsDragging(false);

      if (disabled || !onSortOrderUpdate) {
        setLocalItems(data);
        return;
      }

      // Update local state optimistically
      setLocalItems(data);
      isUpdatingRef.current = true;

      try {
        // Generate sort order updates
        const updates: SortOrderUpdate[] = data.map((item, index) => ({
          id: item.id,
          sortOrder: index * 10,
        }));

        await onSortOrderUpdate(updates);
      } catch (error) {
        console.error('Failed to update sort order:', error);
        // Revert to original order on error
        setLocalItems(items);
      } finally {
        isUpdatingRef.current = false;
      }
    },
    [disabled, onSortOrderUpdate, items],
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
            item={item}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            drag={disabled ? undefined : drag}
            isActive={isActive}
          />
        </ScaleDecorator>
      );
    },
    [onItemPress, onItemEdit, onItemDelete, disabled],
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
        refreshControl={
          onRefresh && !isDragging ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        contentContainerStyle={{
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
        }}
        activationDistance={disabled ? 999999 : 20}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
