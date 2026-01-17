import React, {
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  AnimatedFlashList,
  type AnimatedFlashListRef,
  type AnimatedRenderItemInfo,
} from '@souscheflabs/reanimated-flashlist';
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
    // Ref to AnimatedFlashList
    const flashListRef = useRef<AnimatedFlashListRef>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      prepareForLayoutAnimation: () => {
        flashListRef.current?.prepareForLayoutAnimation();
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

    // Key extractor - ensure we have a valid ID
    const keyExtractor = useCallback(
      (item: SortableShoppingListItem) =>
        item?.id ?? `invalid-${Math.random()}`,
      [],
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
        prepareForLayoutAnimation: () => {
          flashListRef.current?.prepareForLayoutAnimation();
        },
        onSortOrderUpdate,
        onReorderByDelta: undefined, // No longer needed - AnimatedFlashList handles this
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
        onSortOrderUpdate,
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
      [
        canRemoveItems,
        canEditItems,
        canMarkPurchased,
        canReorderItems,
        disabled,
      ],
    );

    // Filter out invalid items to prevent empty card renders
    // This handles edge cases where Apollo cache returns items with missing data
    const validItems = useMemo(
      () => items.filter(item => item?.id && item?.title),
      [items],
    );

    // Render item function - passes AnimatedFlashList info to SimpleDraggableItem
    // Note: Invalid items are already filtered in validItems, no null check needed
    const renderItem = useCallback(
      (info: AnimatedRenderItemInfo<SortableShoppingListItem>) => (
        <SimpleDraggableItem {...info} />
      ),
      [],
    );

    // Determine if an item can be dragged
    const canDrag = useCallback(
      (item: SortableShoppingListItem) => {
        return !item.isPurchased && canReorderItems;
      },
      [canReorderItems],
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
        <SortableListActionsProvider
          actions={actions}
          permissions={permissions}
        >
          <View style={styles.container}>
            <AnimatedFlashList<SortableShoppingListItem>
              ref={flashListRef}
              data={validItems}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              dragEnabled={canReorderItems}
              canDrag={canDrag}
              onReorderByNeighbors={onSortOrderUpdate}
              showsVerticalScrollIndicator={
                flatListProps.showsVerticalScrollIndicator ?? true
              }
              contentContainerStyle={{
                paddingTop: 8,
                paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
              }}
              ListFooterComponent={ListFooterComponent ?? undefined}
              onEndReached={onEndReached}
              onEndReachedThreshold={onEndReachedThreshold}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          </View>
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
