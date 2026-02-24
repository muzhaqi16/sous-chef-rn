import React, { useMemo } from 'react';
import { ScrollView, RefreshControl } from 'react-native-gesture-handler';
import { EmptyState } from '#components/base/EmptyState';
import { SortableShoppingList } from '#components/organisms/SortableShoppingList/SortableList';
import { CollapsiblePurchasedSection } from '#components/molecules/CollapsiblePurchasedSection';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList/types';

interface ShoppingListContentProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  purchasedSectionExpanded?: boolean;
  onPurchasedSectionExpandedChange?: (expanded: boolean) => void;
}

const ShoppingListContentComponent: React.FC<ShoppingListContentProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onRefresh,
  refreshing,
  disabled,
  emptyState,
  onClearAllPurchased,
  onSwipeableWillOpen,
  onSwipeableClose,
  purchasedSectionExpanded,
  onPurchasedSectionExpandedChange,
}) => {
  // Separate items by purchased status with memoization
  const unpurchasedItems = useMemo(
    () => items.filter(item => !item.isPurchased),
    [items],
  );

  const purchasedItems = useMemo(
    () => items.filter(item => item.isPurchased),
    [items],
  );

  if (items.length === 0 && emptyState) {
    return (
      <ScrollView
        contentContainerStyle={{ flex: 1 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing || false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        <EmptyState {...emptyState} />
      </ScrollView>
    );
  }

  return (
    <>
      {/* Unpurchased Items */}
      <SortableShoppingList
        items={unpurchasedItems}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        disabled={disabled}
        showsVerticalScrollIndicator={true}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListFooterComponent={
          /* Collapsible Purchased Section */
          <CollapsiblePurchasedSection
            key="purchased-section-footer"
            purchasedItems={purchasedItems}
            unpurchasedCount={unpurchasedItems.length}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            onClearAll={onClearAllPurchased}
            disabled={disabled}
            onSwipeableWillOpen={onSwipeableWillOpen}
            onSwipeableClose={onSwipeableClose}
            isExpanded={purchasedSectionExpanded}
            onExpandedChange={onPurchasedSectionExpandedChange}
          />
        }
      />
    </>
  );
};

export const ShoppingListContent = ShoppingListContentComponent;
