import React, { useState, useMemo, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../base/EmptyState';
import { ItemCard } from './ItemCard';
import { IconName } from '#/utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
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
  emptyState,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const { bottom: safeBottom} = useSafeAreaInsets();

  // Dynamic content style with proper bottom padding for tab bar
  const contentStyle = useMemo(
    () => ({
      paddingBottom: getTabBarBottomPadding(safeBottom),
    }),
    [safeBottom],
  );

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  // Performance optimization: memoize renderItem
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Item>) => (
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
    ),
    [onItemPress, onItemEdit, onItemDelete, onItemConsume, onItemWaste, onItemRestock, onSwipeableWillOpen, testIDPrefix],
  );

  const keyExtractor = useCallback((item: Item) => item.id, []);

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
  );
};
