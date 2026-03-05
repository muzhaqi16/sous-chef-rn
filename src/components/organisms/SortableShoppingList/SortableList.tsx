import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  FlashList,
  type ListRenderItemInfo } from '@shopify/flash-list';
import type {
  SortableShoppingListProps,
  SortableShoppingListItem } from './types';
import { SwipeableListItem } from './SortableItem';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions } from './SortableListActionsContext';
import {
  SortableListThemeContext,
  type SortableListThemeColors } from './SortableListThemeContext';
import { getTabBarBottomPadding } from '#constants/layout';

// Module-scope functions — zero runtime overhead (no compiler tracking/comparison)
const keyExtractor = (item: SortableShoppingListItem) => item.id;
const renderItem = (info: ListRenderItemInfo<SortableShoppingListItem>) => (
  <SwipeableListItem {...info} />
);

const SortableShoppingListComponent: React.FC<SortableShoppingListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onSortOrderUpdate,
  disabled = false,
  ListHeaderComponent,
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
  ListEmptyComponent,
}) => {
  // PERFORMANCE: Single useUnistyles call for entire list
  const { theme } = useUnistyles();
  // PERFORMANCE: Single useWindowDimensions call - shared via context to avoid N subscriptions in items
  const { width: screenWidth } = useWindowDimensions();
  const themeColors: SortableListThemeColors = {
    primary: theme.colors.primary,
    textPrimary: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    surfaceVariant: theme.colors.surfaceVariant,
    surface: theme.colors.surface,
    border: theme.colors.border,
    screenWidth,
  };

  // Safe area insets for bottom padding
  const insets = useSafeAreaInsets();

  // Coordinate swipeable items — use external coordinator if provided, otherwise internal fallback
  const internalCoordinator = useSwipeableCoordinator();
  const handleSwipeableWillOpen = externalOnSwipeableWillOpen ?? internalCoordinator.handleSwipeableWillOpen;
  const handleSwipeableClose = internalCoordinator.handleSwipeableClose;

  // Actions for context
  const actions: SortableListActions = {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSwipeableWillOpen: handleSwipeableWillOpen,
    onSwipeableClose: handleSwipeableClose,
    onSortOrderUpdate,
  };

  const permissions: SortableListPermissions = {
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems,
    disabled,
  };

  // React Compiler auto-memoizes based on insets.bottom dependency
  const contentContainerStyle = {
    paddingTop: 8,
    paddingBottom: getTabBarBottomPadding(insets.bottom),
  };

  return (
    <SortableListThemeContext.Provider value={themeColors}>
      <SortableListActionsProvider
        actions={actions}
        permissions={permissions}
      >
        <View style={styles.container}>
          <FlashList<SortableShoppingListItem>
            data={items}
            extraData={`${disabled}-${canRemoveItems}-${canEditItems}-${canMarkPurchased}-${canReorderItems}`}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            drawDistance={350}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentContainerStyle}
            ListHeaderComponent={ListHeaderComponent ?? undefined}
            ListFooterComponent={ListFooterComponent ?? undefined}
            ListEmptyComponent={ListEmptyComponent ?? undefined}
            onEndReached={onEndReached}
            onEndReachedThreshold={onEndReachedThreshold}
            onRefresh={onRefresh}
            refreshing={refreshing}
            maintainVisibleContentPosition={{ disabled: true }}
          />
        </View>
      </SortableListActionsProvider>
    </SortableListThemeContext.Provider>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1 } }));

export const SortableShoppingList = SortableShoppingListComponent;
