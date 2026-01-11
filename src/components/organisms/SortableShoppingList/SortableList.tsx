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
import { useProgressiveList } from '#hooks/performance';
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

/**
 * Item wrapper component
 * Layout animations removed to prevent conflicts with FlashList virtualization.
 * Exit animations are handled by useItemExitAnimation in SortableItem.
 */
const ItemWrapper: React.FC<{ item: SortableShoppingListItem }> = React.memo(
  ({ item }) => <SimpleDraggableItem item={item} isActive={false} />,
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
      disabled = false,
      ListFooterComponent,
      onSwipeableWillOpen: externalOnSwipeableWillOpen,
      onRefresh,
      refreshing = false,
      canRemoveItems = true,
      canEditItems = true,
      canMarkPurchased = true,
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

  // PERFORMANCE: Progressive rendering disabled to prevent scroll flickering
  // FlashList's virtualization handles large lists efficiently with estimatedItemSize
  const progressiveItems = useProgressiveList(items, {
    initialBatch: 8,
    batchSize: 4,
    batchDelay: 16,
    enabled: false,
  });

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
    ],
  );

  const permissions = useMemo<SortableListPermissions>(
    () => ({
      canRemoveItems,
      canEditItems,
      canMarkPurchased,
      disabled,
    }),
    [canRemoveItems, canEditItems, canMarkPurchased, disabled],
  );

  // Render item for FlashList
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SortableShoppingListItem>) => (
      <ItemWrapper item={item} />
    ),
    [],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: SortableShoppingListItem) => item.id,
    [],
  );

  // Early validation
  if (!items || !Array.isArray(items)) {
    console.warn('SortableList: items is not a valid array', items);
    return null;
  }

  if (items.length === 0) {
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
        <View style={styles.container}>
          <FlashList
            ref={flashListRef}
            data={progressiveItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
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
