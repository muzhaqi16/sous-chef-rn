import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../base/EmptyState';
import { ItemCard } from './ItemCard';
import { IconName } from '#/utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
import { createPropsComparator } from '#utils/memoUtils';
import {
  ItemListActionsProvider,
  useItemListActions,
  type ItemListActions,
} from './ItemListActionsContext';

// Module-scope keyExtractor — zero runtime overhead
const keyExtractor = (item: Item) => item.id;

interface Item {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
}

// Bridge component — reads actions from context, renders ItemCard
const ItemListRenderItemComponent: React.FC<ListRenderItemInfo<Item>> = ({
  item,
  index,
}) => {
  const { actions } = useItemListActions();
  const {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onItemConsume,
    onItemWaste,
    onItemRestock,
    onSwipeableWillOpen,
    testIDPrefix,
  } = actions;

  return (
    <ItemCard
      id={item.id}
      title={item.title}
      subtitle={item.subtitle}
      badge={item.badge}
      leftElement={item.leftElement}
      rightElement={item.rightElement}
      onPress={() => onItemPress(item.id)}
      onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
      onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
      onConsume={onItemConsume ? () => onItemConsume(item.id) : undefined}
      onWaste={onItemWaste ? () => onItemWaste(item.id) : undefined}
      onRestock={onItemRestock ? () => onItemRestock(item.id) : undefined}
      onSwipeableWillOpen={onSwipeableWillOpen}
      testID={testIDPrefix ? `${testIDPrefix}-${index}` : undefined}
    />
  );
};

// PERFORMANCE: Custom comparator for React.memo — value-equality on nested item fields
const arePropsEqual = createPropsComparator<ListRenderItemInfo<Item>>({
  nestedComparisons: {
    item: ['id', 'title', 'subtitle'],
    'item.badge': ['text', 'variant'],
  },
});

const ItemListRenderItem = React.memo(ItemListRenderItemComponent, arePropsEqual);

// Module-scope renderItem — zero runtime overhead (no compiler tracking/comparison)
const renderItem = (info: ListRenderItemInfo<Item>) => (
  <ItemListRenderItem {...info} />
);

interface ItemListProps {
  items: Item[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  testIDPrefix?: string;
  emptyState?: {
    icon: IconName;
    title: string;
    description?: string;
    action?: {
      label: string;
      onPress: () => void;
    };
  };
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onItemConsume,
  onItemWaste,
  onItemRestock,
  onRefresh,
  onSwipeableWillOpen,
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListHeaderComponent,
  ListFooterComponent,
  testIDPrefix,
  emptyState }) => {
  const [refreshing, setRefreshing] = useState(false);
  const { bottom: safeBottom} = useSafeAreaInsets();

  // Dynamic content style with proper bottom padding for tab bar
  const contentStyle = ({
      paddingBottom: getTabBarBottomPadding(safeBottom) });

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  // Bundle actions for context provider
  const actions: ItemListActions = {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onItemConsume,
    onItemWaste,
    onItemRestock,
    onSwipeableWillOpen,
    testIDPrefix,
  };

  // extraData encodes action availability — FlashList re-renders items when this changes
  const extraData = `${!!onItemEdit}-${!!onItemDelete}-${!!onItemConsume}-${!!onItemWaste}-${!!onItemRestock}`;

  if (items.length === 0 && emptyState) {
    return (
      <>
        {!!ListHeaderComponent && (typeof ListHeaderComponent === 'function' ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          ))}
        <EmptyState {...emptyState} />
      </>
    );
  }

  return (
    <ItemListActionsProvider actions={actions}>
      <FlashList
        data={items}
        keyExtractor={keyExtractor}
        contentContainerStyle={contentStyle}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
        renderItem={renderItem}
        extraData={extraData}
        // FlashList v2: Pre-render items 200px outside viewport for smoother scrolling
        drawDistance={200}
        // Native onEndReached support
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListHeaderComponent={
          ListHeaderComponent ? (typeof ListHeaderComponent === 'function' ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          )) : null
        }
        ListFooterComponent={
          ListFooterComponent ? (typeof ListFooterComponent === 'function' ? (
            <ListFooterComponent />
          ) : (
            ListFooterComponent
          )) : null
        }
      />
    </ItemListActionsProvider>
  );
};
