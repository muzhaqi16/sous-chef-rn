import React, { useState, useCallback, useRef } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SortableShoppingListProps } from './types';
import { SimpleDraggableItem } from './SortableItem';
import { useTabBarVisibility } from '#/context/TabBarVisibilityContext';

export const SortableShoppingList: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onSortOrderUpdate,
  itemHeight = 100,
  disabled = false,
  groupByPurchased = false,
  ...flatListProps
}) => {
  // Track drag state only
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedItems, setDraggedItems] = useState<typeof items | null>(null);

  // Tab bar visibility integration
  const { updateScrollVisibility } = useTabBarVisibility();
  const lastScrollY = useRef(0);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Handle drag start
  const handleDragStart = useCallback(
    (index: number) => {
      if (disabled) return;
      setDraggedIndex(index);
      // Create a copy of items for drag operations
      setDraggedItems([...items]);
    },
    [disabled, items],
  );

  // Handle drag end with reordering
  const handleDragEnd = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (disabled || fromIndex === toIndex || !draggedItems) {
        setDraggedIndex(null);
        setDraggedItems(null);
        return;
      }

      // Create new ordered array from dragged items
      const newItems = [...draggedItems];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);

      // Apply group constraints if grouping is enabled
      let finalItems = newItems;
      if (groupByPurchased) {
        // Separate purchased and unpurchased items
        const unpurchased = finalItems.filter(item => !item.isPurchased);
        const purchased = finalItems.filter(item => item.isPurchased);

        // Check if we're trying to move across groups
        const originalItem = draggedItems[fromIndex];
        const targetIsPurchasedSection = toIndex >= unpurchased.length;

        if (originalItem.isPurchased !== targetIsPurchasedSection) {
          // Revert - don't allow cross-group moves
          setDraggedIndex(null);
          setDraggedItems(null);
          return;
        }

        // Maintain group separation
        finalItems = [...unpurchased, ...purchased];
      }

      // Update drag state with new order for immediate visual feedback
      setDraggedItems(finalItems);
      setDraggedIndex(null);

      // Calculate sort order updates for API
      if (onSortOrderUpdate) {
        try {
          const updates = finalItems.map((item, index) => ({
            id: item.id,
            sortOrder: index * 10, // Simple sequential ordering
          }));

          await onSortOrderUpdate(updates);
          // Clear drag state after successful API call
          setDraggedItems(null);
        } catch (error) {
          console.error('Failed to update sort order:', error);
          // Clear drag state on error - Apollo will maintain correct state
          setDraggedItems(null);
        }
      } else {
        // No API call needed, just clear drag state
        setDraggedItems(null);
      }
    },
    [draggedItems, disabled, groupByPurchased, onSortOrderUpdate],
  );

  // Handle hover during drag (for visual feedback)
  const handleDragHover = useCallback((_index: number) => {
    // Could add visual feedback here if needed
  }, []);

  // Handle scroll for tab bar visibility
  const handleScroll = useCallback(
    (event: any) => {
      const currentY = event.nativeEvent.contentOffset.y;
      updateScrollVisibility(currentY, lastScrollY.current);
      lastScrollY.current = currentY;
    },
    [updateScrollVisibility],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (!item || !item.id) {
        console.warn('SimpleDraggableList: invalid item at index', index, item);
        return null;
      }

      return (
        <SimpleDraggableItem
          key={item.id}
          item={item}
          index={index}
          itemHeight={itemHeight}
          onItemPress={onItemPress}
          onItemEdit={onItemEdit}
          onItemDelete={onItemDelete}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragHover={handleDragHover}
          isDragged={draggedIndex === index}
          disabled={disabled}
        />
      );
    },
    [
      itemHeight,
      onItemPress,
      onItemEdit,
      onItemDelete,
      handleDragStart,
      handleDragEnd,
      handleDragHover,
      draggedIndex,
      disabled,
    ],
  );

  // Use dragged items during drag operation, otherwise use props
  const displayItems = draggedItems || items;

  // Early validation
  if (!items || !Array.isArray(items)) {
    console.warn('SimpleDraggableList: items is not a valid array', items);
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        {...flatListProps}
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        getItemLayout={(_data, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        scrollEnabled={draggedIndex === null} // Disable scroll during drag
        showsVerticalScrollIndicator={
          flatListProps.showsVerticalScrollIndicator ?? true
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          {
            paddingBottom: Math.max(insets.bottom, 16) + 80, // Safe area + tab bar + extra space
          },
          flatListProps.contentContainerStyle,
        ]}
      />
    </View>
  );
};
