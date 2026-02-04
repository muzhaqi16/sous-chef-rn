import React, {
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import type {
  SortableShoppingListProps,
  SortableShoppingListItem,
} from './types';
import { SwipeableListItem } from './SortableItem';
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
  // No methods currently exposed - placeholder for future functionality
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
    // Ref to FlashList
    const flashListRef = useRef<FlashListRef<SortableShoppingListItem>>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({}));

    // PERFORMANCE: Single useUnistyles call for entire list
    const { theme } = useUnistyles();
    // PERFORMANCE: Single useWindowDimensions call - shared via context to avoid N subscriptions in items
    const { width: screenWidth } = useWindowDimensions();
    const themeColors = useMemo<SortableListThemeColors>(
      () => ({
        primary: theme.colors.primary,
        textPrimary: theme.colors.textPrimary,
        textSecondary: theme.colors.textSecondary,
        surfaceVariant: theme.colors.surfaceVariant,
        surface: theme.colors.surface,
        border: theme.colors.border,
        screenWidth,
      }),
      [
        theme.colors.primary,
        theme.colors.textPrimary,
        theme.colors.textSecondary,
        theme.colors.surfaceVariant,
        theme.colors.surface,
        theme.colors.border,
        screenWidth,
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
        onSortOrderUpdate,
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

    // PERFORMANCE: Memoize contentContainerStyle to prevent FlashList v2 re-renders
    // FlashList v2 is aggressive about prop changes - new object refs trigger internal updates
    const contentContainerStyle = useMemo(
      () => ({
        paddingTop: 8,
        paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16,
      }),
      [insets.bottom],
    );

    // Render item function - passes FlashList info to SwipeableListItem
    // Note: Invalid items are already filtered in validItems, no null check needed
    const renderItem = useCallback(
      (info: ListRenderItemInfo<SortableShoppingListItem>) => (
        <SwipeableListItem {...info} />
      ),
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
        <SortableListActionsProvider
          actions={actions}
          permissions={permissions}
        >
          <View style={styles.container}>
            <FlashList<SortableShoppingListItem>
              ref={flashListRef}
              data={validItems}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              drawDistance={500}
              showsVerticalScrollIndicator={
                flatListProps.showsVerticalScrollIndicator ?? true
              }
              contentContainerStyle={contentContainerStyle}
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
