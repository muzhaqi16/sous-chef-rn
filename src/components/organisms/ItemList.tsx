import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  ScrollView,
} from 'react-native';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../base/EmptyState';
import { ItemCard } from './ItemCard';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { IconName } from '#/utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
import type { SwipeableRef } from '#components/molecules/SwipeableItem/types';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { CachedImage, preloadImages } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
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
  leftElement?: React.ReactNode;
  imageUrl?: string; // Pass URL as data — renderItem creates CachedImage (avoids JSX in transforms)
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

  // Render CachedImage from imageUrl data — avoids creating JSX in parent transforms
  const leftElement =
    item.leftElement ??
    (item.imageUrl ? (
      <View style={commonStyles.listItemImageContainerCompact}>
        <CachedImage
          uri={item.imageUrl}
          style={commonStyles.listItemImageCompact}
          displaySize={48}
        />
      </View>
    ) : undefined);

  return (
    <ItemCard
      id={item.id}
      title={item.title}
      subtitle={item.subtitle}
      badge={item.badge}
      leftElement={leftElement}
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

const ItemListRenderItem = ItemListRenderItemComponent;

// Module-scope renderItem — zero runtime overhead (no compiler tracking/comparison)
const renderItem = (info: ListRenderItemInfo<Item>) => (
  <ItemListRenderItem {...info} />
);

// Module-scope getItemType — all items are the same type for optimal recycler pooling
const getItemType = () => 'item';

// Stable config — prevents scroll jumps during data updates (matches PantryContent & SortableList)
const MVCP_DISABLED = { disabled: true };

interface ItemListProps {
  items: Item[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListHeaderComponent?:
    | React.ComponentType<Record<string, never>>
    | React.ReactElement
    | null;
  ListFooterComponent?:
    | React.ComponentType<Record<string, never>>
    | React.ReactElement
    | null;
  testIDPrefix?: string;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  scrollEventThrottle?: number;
  /** When this key changes, scroll resets to top (prevents FlashList v2 blank-cell regression). */
  dataMode?: string;
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
  onEndReachedThreshold = FLASHLIST_DEFAULTS.fullScreen.onEndReachedThreshold,
  ListHeaderComponent,
  ListFooterComponent,
  testIDPrefix,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle,
  dataMode,
  emptyState,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const flashListRef = useRef<FlashListRef<Item>>(null);
  const { bottom: safeBottom } = useSafeAreaInsets();
  const deferredItems = useDeferredValue(items);

  // ── Performance instrumentation (matches PantryContent & SortableList) ──
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'ItemList',
  });
  useDataReferenceTracker(
    deferredItems,
    'ItemList.deferredItems',
    perfCallbacks.onDataReferenceChange,
  );

  // ── Image preloading — covers all items including paginated appends ──
  useEffect(() => {
    const urls: string[] = [];
    for (const item of items) {
      if (item.imageUrl) urls.push(item.imageUrl);
    }
    if (urls.length > 0) preloadImages(urls);
  }, [items]);

  // ── Scroll reset on data mode change (prevents FlashList v2 blank-cell regression) ──
  const prevDataMode = useRef(dataMode);
  useEffect(() => {
    if (dataMode !== undefined && prevDataMode.current !== dataMode) {
      requestAnimationFrame(() => {
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
    prevDataMode.current = dataMode;
  }, [dataMode]);

  // Dynamic content style with proper bottom padding for tab bar
  const contentStyle = {
    paddingBottom: getTabBarBottomPadding(safeBottom),
  };

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
    onItemDelete: onItemDelete
      ? (id: string) => {
          flashListRef.current?.prepareForLayoutAnimationRender();
          onItemDelete(id);
        }
      : undefined,
    onItemConsume,
    onItemWaste,
    onItemRestock,
    onSwipeableWillOpen,
    testIDPrefix,
  };

  // extraData encodes action availability — FlashList re-renders items when this changes
  const extraData = `${!!onItemEdit}-${!!onItemDelete}-${!!onItemConsume}-${!!onItemWaste}-${!!onItemRestock}`;

  if (deferredItems.length === 0 && emptyState) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: contentStyle.paddingBottom,
        }}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={scrollEventThrottle}
        // Deliver taps on header/row buttons on the first touch even while the
        // keyboard is up (default "never" swallows the first tap to dismiss the
        // keyboard, forcing a second tap on the search button). Taps on empty
        // space still dismiss the keyboard.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <ThemedRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : undefined
        }
      >
        {!!ListHeaderComponent &&
          (typeof ListHeaderComponent === 'function' ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          ))}
        <EmptyState {...emptyState} />
      </ScrollView>
    );
  }

  return (
    <ItemListActionsProvider actions={actions}>
      <FlashList
        ref={flashListRef}
        data={deferredItems}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        CellRendererComponent={AnimatedCellRenderer}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={scrollEventThrottle}
        // Deliver taps on header/row buttons on the first touch even while the
        // keyboard is up (default "never" swallows the first tap to dismiss the
        // keyboard, forcing a second tap on the search button). Taps on empty
        // space still dismiss the keyboard.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <ThemedRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          ) : undefined
        }
        renderItem={renderItem}
        extraData={extraData}
        drawDistance={FLASHLIST_DEFAULTS.fullScreen.drawDistance}
        maintainVisibleContentPosition={MVCP_DISABLED}
        onLoad={perfCallbacks.onLoad}
        onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListHeaderComponent={
          ListHeaderComponent ? (
            typeof ListHeaderComponent === 'function' ? (
              <ListHeaderComponent />
            ) : (
              ListHeaderComponent
            )
          ) : null
        }
        ListFooterComponent={
          ListFooterComponent ? (
            typeof ListFooterComponent === 'function' ? (
              <ListFooterComponent />
            ) : (
              ListFooterComponent
            )
          ) : null
        }
      />
    </ItemListActionsProvider>
  );
};
