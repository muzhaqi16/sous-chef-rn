import React, { useState, useMemo, useCallback } from 'react';
import { RefreshControl, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../base/EmptyState';
import { ItemCard } from './ItemCard';
import { IconName } from '#/utils/iconUtils';

// Tab bar height constant (65px from FloatingTabBar)
const TAB_BAR_HEIGHT = 65;

// ItemCard height constant for getItemLayout optimization
// Measured from actual ItemCard component (height + marginBottom)
const ITEM_HEIGHT = 72;
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
      paddingBottom: TAB_BAR_HEIGHT + safeBottom + 16, // Tab bar height + safe area + extra padding
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

  const handleScroll = (event: any) => {
    if (!onEndReached) return;

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = contentSize.height * onEndReachedThreshold;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom) {
      onEndReached();
    }
  };

  // Performance optimization: getItemLayout for known item heights
  // Avoids expensive layout measurement for better scroll performance
  const getItemLayout = useCallback(
    (_data: ArrayLike<Item> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  // Performance optimization: memoize renderItem
  const renderItem = useCallback(
    ({ item, index }: { item: Item; index: number }) => (
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

  if (items.length === 0 && emptyState) {
    return (
      <>
        {ListHeaderComponent &&
          (typeof ListHeaderComponent === 'function' ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          ))}
        <EmptyState {...emptyState} />
      </>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={contentStyle}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
      onScroll={handleScroll}
      scrollEventThrottle={400}
      renderItem={renderItem}
      // Performance optimizations for large lists
      getItemLayout={getItemLayout}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      removeClippedSubviews={true}
      ListHeaderComponent={
        ListHeaderComponent &&
        (typeof ListHeaderComponent === 'function' ? (
          <ListHeaderComponent />
        ) : (
          ListHeaderComponent
        ))
      }
      ListFooterComponent={
        ListFooterComponent &&
        (typeof ListFooterComponent === 'function' ? (
          <ListFooterComponent />
        ) : (
          ListFooterComponent
        ))
      }
    />
  );
};
