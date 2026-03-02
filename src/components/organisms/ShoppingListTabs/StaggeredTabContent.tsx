import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList/SortableList';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { useStaggeredEntry } from '#context/StaggeredEntryContext';
import { staggeredEntryAnimation } from '#constants/animations';

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
  isLoadingMore,
  canRemoveItems,
  canEditItems,
  canMarkPurchased,
  onSortOrderUpdate,
  canReorderItems,
  onMoveToPantry,
}) => {
  const staggerCtx = useStaggeredEntry();

  // Mark initial render complete after stagger animation window
  useEffect(() => {
    const totalStaggerTime =
      staggeredEntryAnimation.initialDelay +
      staggeredEntryAnimation.maxItems * staggeredEntryAnimation.delayPerItem +
      staggeredEntryAnimation.duration;

    const timer = setTimeout(() => {
      staggerCtx?.markInitialRenderComplete();
    }, totalStaggerTime);

    return () => clearTimeout(timer);
  }, [staggerCtx]);

  const footerComponent = (
    <PaginationFooter
      isLoadingMore={!!isLoadingMore}
      hasMore={!!hasMore}
      loading={false}
      itemCount={items.length}
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
        showsVerticalScrollIndicator={true}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        ListFooterComponent={footerComponent}
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
        canReorderItems={canReorderItems}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
