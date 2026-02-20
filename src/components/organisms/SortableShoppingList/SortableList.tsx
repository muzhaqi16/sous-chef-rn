import React, {
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
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
import { getTabBarBottomPadding } from '#constants/layout';

/**
 * Ref handle for SortableShoppingList
 * Exposes methods for parent components to control list behavior
 */
export interface SortableShoppingListRef {
  // No methods currently exposed - placeholder for future functionality
}

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

    // Safe area insets for bottom padding
    const insets = useSafeAreaInsets();

    // Coordinate swipeable items — use external coordinator if provided, otherwise internal fallback
    const internalCoordinator = useSwipeableCoordinator();
    const handleSwipeableWillOpen = externalOnSwipeableWillOpen ?? internalCoordinator.handleSwipeableWillOpen;
    const handleSwipeableClose = internalCoordinator.handleSwipeableClose;

    // Key extractor - validItems already guarantees every item has an id
    const keyExtractor = useCallback(
      (item: SortableShoppingListItem) => item.id,
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
        paddingBottom: getTabBarBottomPadding(insets.bottom),
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
              drawDistance={400}
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

export const SortableShoppingList = SortableShoppingListComponent;
