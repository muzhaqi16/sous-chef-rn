import React, {
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, RefreshControl } from 'react-native';
import { FlashList, ListRenderItemInfo, FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type {
  SortableShoppingListProps,
  SortableShoppingListItem,
} from './types';
import { SimpleDraggableItem } from './SortableItem';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions,
} from './SortableListActionsContext';
import {
  SortableListThemeContext,
  type SortableListThemeColors,
} from './SortableListThemeContext';
import { DragStateProvider } from './DragStateContext';

/**
 * Ref handle for SortableShoppingList
 * Exposes methods for parent components to control list behavior
 */
export interface SortableShoppingListRef {
  /**
   * Call this before removing items to prepare FlashList for layout animation.
   * This prevents visual gaps when items are toggled between lists.
   */
  prepareForLayoutAnimation: () => void;
}

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

/**
 * Item wrapper component
 * Layout animations removed to prevent conflicts with FlashList virtualization.
 * Exit animations are handled by useItemExitAnimation in SortableItem.
 *
 * Uses totalItemsRef instead of totalItems value to avoid renderItem callback recreation
 * when items are added/removed. This is critical for FlashList v2 performance.
 */
const ItemWrapper: React.FC<{
  item: SortableShoppingListItem;
  index: number;
  totalItemsRef: React.MutableRefObject<number>;
}> = React.memo(
  ({ item, index, totalItemsRef }) => {
    // Skip rendering invalid items to prevent empty cards
    if (!item?.id || !item?.title) {
      return null;
    }
    return (
      <SimpleDraggableItem
        item={item}
        index={index}
        totalItems={totalItemsRef.current}
        isActive={false}
      />
    );
  },
);

ItemWrapper.displayName = 'ItemWrapper';

const SortableShoppingListComponent = forwardRef<
  SortableShoppingListRef,
  SortableShoppingListProps
>(
  (
    {
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
      onRefresh,
      refreshing = false,
      canRemoveItems = true,
      canEditItems = true,
      canMarkPurchased = true,
      canReorderItems = false,
      onEndReached,
      onEndReachedThreshold = 0.5,
      ...flatListProps
    },
    ref,
  ) => {
    // Ref to FlashList
    const flashListRef = useRef<FlashListRef<SortableShoppingListItem>>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      prepareForLayoutAnimation: () => {
        flashListRef.current?.prepareForLayoutAnimationRender();
      },
    }));

    // PERFORMANCE: Single useUnistyles call for entire list
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

  // Track currently open swipeable item
  const openSwipeableRef = useRef<any>(null);

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Handle swipeable item opening
  const handleSwipeableWillOpen = useCallback(
    (swipeableRef: any) => {
      if (externalOnSwipeableWillOpen) {
        externalOnSwipeableWillOpen(swipeableRef);
      } else {
        if (
          openSwipeableRef.current &&
          openSwipeableRef.current !== swipeableRef
        ) {
          openSwipeableRef.current.current?.close();
        }
        openSwipeableRef.current = swipeableRef;
      }
    },
    [externalOnSwipeableWillOpen],
  );

  const handleSwipeableClose = useCallback(() => {}, []);

  // Prepare FlashList for layout animation before items are removed
  // This must be called before data changes per FlashList docs
  const handlePrepareForLayoutAnimation = useCallback(() => {
    flashListRef.current?.prepareForLayoutAnimationRender();
  }, []);

  // Keep valid items in ref for reorder callback to access current values
  // Use a ref to avoid recreating handleReorderByDelta when items change
  const validItemsRef = useRef<SortableShoppingListItem[]>([]);

  // Handle reorder by index delta - converts to neighbor IDs and calls onSortOrderUpdate
  const handleReorderByDelta = useCallback(
    (itemId: string, indexDelta: number) => {
      if (!onSortOrderUpdate || indexDelta === 0) return;

      const currentItems = validItemsRef.current;
      const currentIndex = currentItems.findIndex(item => item.id === itemId);
      if (currentIndex === -1) return;

      // Calculate new index, clamped to valid range
      const newIndex = Math.max(0, Math.min(currentItems.length - 1, currentIndex + indexDelta));
      if (newIndex === currentIndex) return;

      // Calculate neighbor IDs for the new position
      // afterItemId = the item that will be before this item (at newIndex - 1)
      // beforeItemId = the item that will be after this item (at newIndex + 1)
      // But we need to account for the moved item being removed from its current position

      let afterItemId: string | null = null;
      let beforeItemId: string | null = null;

      if (indexDelta > 0) {
        // Moving down - newIndex is where item will end up
        // Item at newIndex will be "before" (actually after in visual order)
        afterItemId = currentItems[newIndex]?.id ?? null;
        beforeItemId = newIndex < currentItems.length - 1 ? currentItems[newIndex + 1]?.id ?? null : null;
      } else {
        // Moving up - newIndex is where item will end up
        afterItemId = newIndex > 0 ? currentItems[newIndex - 1]?.id ?? null : null;
        beforeItemId = currentItems[newIndex]?.id ?? null;
      }

      console.log(`📦 Reorder: ${itemId} from ${currentIndex} to ${newIndex}, after=${afterItemId}, before=${beforeItemId}`);
      onSortOrderUpdate(itemId, afterItemId, beforeItemId);
    },
    [onSortOrderUpdate],
  );

  // Memoize actions for context
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
      prepareForLayoutAnimation: handlePrepareForLayoutAnimation,
      onSortOrderUpdate,
      onReorderByDelta: handleReorderByDelta,
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
      handlePrepareForLayoutAnimation,
      onSortOrderUpdate,
      handleReorderByDelta,
    ],
  );

  const permissions = useMemo<SortableListPermissions>(
    () => ({
      canRemoveItems,
      canEditItems,
      canMarkPurchased,
      canReorderItems,
      disabled,
    }),
    [canRemoveItems, canEditItems, canMarkPurchased, canReorderItems, disabled],
  );

  // Filter out invalid items to prevent empty card renders
  // This handles edge cases where Apollo cache returns items with missing data
  const validItems = useMemo(
    () => items.filter(item => item?.id && item?.title),
    [items],
  );

  // Keep ref in sync for reorder callback (avoids callback recreation)
  validItemsRef.current = validItems;

  // PERFORMANCE: Use ref for totalItems to avoid renderItem callback recreation
  // This is critical for FlashList v2 where memoization is more important
  const totalItemsRef = useRef(validItems.length);
  totalItemsRef.current = validItems.length;

  // Render item for FlashList - stable callback with no dependencies
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<SortableShoppingListItem>) => (
      <ItemWrapper item={item} index={index} totalItemsRef={totalItemsRef} />
    ),
    [],
  );

  // getItemType for FlashList v2 recycling optimization
  // Note: Keep simple - docs warn "This method is called very frequently. Keep it fast."
  const getItemType = useCallback(
    () => 'shopping-item',
    [],
  );

  // Key extractor - ensure we have a valid ID
  const keyExtractor = useCallback(
    (item: SortableShoppingListItem) => item?.id ?? `invalid-${Math.random()}`,
    [],
  );

  // Early validation
  if (!items || !Array.isArray(items)) {
    console.warn('SortableList: items is not a valid array', items);
    return null;
  }

  if (validItems.length === 0) {
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
    <SortableListThemeContext.Provider value={themeColors}>
      <SortableListActionsProvider actions={actions} permissions={permissions}>
        <DragStateProvider>
          <View style={styles.container}>
            <FlashList
            ref={flashListRef}
            data={validItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            // FlashList v2 optimizations:
            // - drawDistance: Pre-render buffer to reduce blank areas during fast scroll
            // - maintainVisibleContentPosition: Disabled to prevent item movement during drag reorder
            //   (known issue in v2: https://shopify.github.io/flash-list/docs/known-issues/)
            drawDistance={300}
            maintainVisibleContentPosition={{ disabled: true }}
            showsVerticalScrollIndicator={
              flatListProps.showsVerticalScrollIndicator ?? true
            }
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
            }}
            ListFooterComponent={ListFooterComponent}
            onEndReached={onEndReached}
            onEndReachedThreshold={onEndReachedThreshold}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={themeColors.primary}
                  colors={[themeColors.primary]}
                />
              ) : undefined
            }
            />
          </View>
        </DragStateProvider>
      </SortableListActionsProvider>
    </SortableListThemeContext.Provider>
  );
  },
);

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));

export const SortableShoppingList = React.memo(SortableShoppingListComponent);
