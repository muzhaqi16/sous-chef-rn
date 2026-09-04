import React from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList/SortableList';
import type {
  ShoppingListRowItem,
  SortableShoppingListProps,
} from '../SortableShoppingList/types';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { ShoppingListItemSkeleton } from '#features/shoppingList/components/skeletons/ShoppingListItemSkeleton';

interface StaggeredTabContentProps {
  items: ShoppingListRowItem[];
  /** Whether row cells render their product image */
  showImages?: boolean;
  onItemPress: (id: string) => void;
  itemSwipeActions?: SortableShoppingListProps['itemSwipeActions'];
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onQuantityPress?: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  onEndReached?: () => void;
  hasMore?: boolean;
  /** True while a next-page fetch is in flight — gates the footer skeleton. */
  isLoadingMore?: boolean;
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
  listEmptyComponent?: FlashListProps<ShoppingListRowItem>['ListEmptyComponent'];
  // Scroll direction tracking
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  scrollEventThrottle?: number;
  // Scrollable header content
  listHeaderComponent?: React.ReactElement | null;
  /** First FlashList layout commit with rows visible — see SortableShoppingListProps. */
  onFirstContentLayout?: () => void;
}

export const StaggeredTabContent: React.FC<StaggeredTabContentProps> = ({
  items,
  showImages,
  onItemPress,
  itemSwipeActions,
  onTogglePurchase,
  onQuantityPress,
  onRefresh,
  refreshing,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  hasMore,
  isLoadingMore,
  canRemoveItems,
  canEditItems,
  canMarkPurchased,
  onSortOrderUpdate,
  canReorderItems,
  onMoveToPantry,
  listEmptyComponent,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
  listHeaderComponent,
  onFirstContentLayout,
}) => {
  const footerComponent = (
    <PaginationFooter
      hasMore={!!hasMore}
      isFetchingMore={!!isLoadingMore}
      itemCount={items.length}
      SkeletonComponent={ShoppingListItemSkeleton}
      skeletonCount={3}
    />
  );

  return (
    <View style={styles.container}>
      <SortableShoppingList
        items={items}
        showImages={showImages}
        onItemPress={onItemPress}
        itemSwipeActions={itemSwipeActions}
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
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={scrollEventThrottle}
        ListHeaderComponent={listHeaderComponent}
        onFirstContentLayout={onFirstContentLayout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
