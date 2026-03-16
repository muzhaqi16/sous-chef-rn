import React from 'react';
import type { ReactElement, ComponentType } from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList/SortableList';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';

interface StaggeredTabContentProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onEndReached?: () => void;
  hasMore?: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  // Optional props that differ between tabs
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  canReorderItems?: boolean;
  onMoveToPantry?: (id: string) => void;
  listEmptyComponent?: ReactElement | ComponentType<any> | null;
  // Collapsible scroll handler
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export const StaggeredTabContent: React.FC<StaggeredTabContentProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onQuantityPress,
  onRefresh,
  refreshing,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  hasMore,
  canRemoveItems,
  canEditItems,
  canMarkPurchased,
  onSortOrderUpdate,
  canReorderItems,
  onMoveToPantry,
  listEmptyComponent,
  onScroll,
  scrollEventThrottle,
}) => {
  const footerComponent = (
    <PaginationFooter
      hasMore={!!hasMore}
      itemCount={items.length}
      SkeletonComponent={ShoppingListItemSkeleton}
      skeletonCount={3}
    />
  );

  return (
    <View style={styles.container}>
      <SortableShoppingList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onQuantityPress={onQuantityPress}
        onSortOrderUpdate={onSortOrderUpdate}
        onMoveToPantry={onMoveToPantry}
        disabled={disabled}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        ListFooterComponent={footerComponent}
        ListEmptyComponent={listEmptyComponent}
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
        canReorderItems={canReorderItems}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
