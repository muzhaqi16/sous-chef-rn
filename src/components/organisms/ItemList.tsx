import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  ScrollView,
} from 'react-native';
import {
  PlainScrollRefreshControl,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import type { SwipeAction } from '#components/molecules/SwipeableItem/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '#components/atoms/EmptyState';
import { ItemCard } from './ItemCard';
import { IconName } from '#/utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
import type { SwipeableRef } from '#components/molecules/SwipeableItem/types';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { CachedImage, preloadImages } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
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
  const { onItemPress, itemSwipeActions, onSwipeableWillOpen, testIDPrefix } =
    actions;
  const swipe = itemSwipeActions?.(item.id);

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
      leftActions={swipe?.left}
      rightActions={swipe?.right}
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
  /** Swipe actions for one row — see `ItemListActions.itemSwipeActions`. */
  itemSwipeActions?: (id: string) => {
    left?: SwipeAction[];
    right?: SwipeAction[];
  };
  /** Called before a row-removing action runs, to prepare the layout animation. */
  onBeforeItemRemoved?: () => void;
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
  itemSwipeActions,
  onBeforeItemRemoved,
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
  // `items` reaches FlashList as-is — never through `useDeferredValue`. A
  // deferred render can be interrupted after FlashList has shrunk its layout
  // table but before cells are re-indexed, and a native `onLayout` in that gap
  // throws "index out of bounds, not enough layouts" (fatal in release). See
  // docs/flashlist-layout-index-race.md.

  // ── Performance instrumentation (matches PantryContent & SortableList) ──
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'ItemList',
    // No loading or placeholder mode here either — see SortableList. An empty
    // `items` reaching this point means the caller supplied no `emptyState`,
    // not that the data has settled, so it does not count as content.
    hasRealContent: items.length > 0,
  });
  useDataReferenceTracker(
    items,
    'ItemList.items',
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

  // Through the helper, never inline: an `await onRefresh()` between two
  // `setRefreshing` calls strands the spinner when the refresh rejects, which
  // Apollo's `refetch()` does on any network error.
  const handleRefresh = () => {
    if (!onRefresh) return;
    executeRefreshWithFinally(onRefresh, setRefreshing);
  };

  // Bundle actions for context provider
  // A row-removing action needs FlashList told before it fires, or the removal
  // animates from the wrong layout. Applied here to every action the caller
  // flagged `removesRow`, rather than only to a handler named `onItemDelete`.
  const actions: ItemListActions = {
    onItemPress,
    itemSwipeActions: itemSwipeActions
      ? (id: string) => {
          const prepare = (list?: SwipeAction[]) =>
            list?.map(action =>
              action.removesRow
                ? {
                    ...action,
                    onPress: () => {
                      flashListRef.current?.prepareForLayoutAnimationRender();
                      onBeforeItemRemoved?.();
                      action.onPress();
                    },
                  }
                : action,
            );
          const built = itemSwipeActions(id);
          return { left: prepare(built.left), right: prepare(built.right) };
        }
      : undefined,
    onSwipeableWillOpen,
    testIDPrefix,
  };

  // extraData encodes whether rows have swipe actions at all — FlashList
  // re-renders items when it changes. The per-row action list is built inside
  // the row, so its contents do not need to appear here.
  const extraData = String(!!itemSwipeActions);

  if (items.length === 0 && emptyState) {
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
            <PlainScrollRefreshControl
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
        renderScrollComponent={SwipeAwareScrollComponent}
        ref={flashListRef}
        data={items}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        CellRendererComponent={perfCallbacks.CellRendererComponent}
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
        onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
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
