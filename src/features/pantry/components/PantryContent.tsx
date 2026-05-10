import React, {
  useDeferredValue,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';
import { View, RefreshControl } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import {
  FlashList,
  type FlashListRef,
  ListRenderItemInfo,
} from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { getTabBarBottomPadding } from '#constants/layout';
import { Icon } from '#utils/iconUtils';
import { LocationFilter } from '#features/pantry/utils/pantryFilters';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import { PantryItem } from '#/graphql/generated/schemaTypes';
import { PantryAlertBar } from '#features/pantry/components/PantryAlertBar';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { preloadImages } from '#components/atoms/CachedImage';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import {
  type StickyHeaderSentinel,
  STICKY_HEADER_SENTINEL,
  isStickyHeaderSentinel,
  STICKY_HEADER_INDICES,
  STICKY_HEADER_CONFIG,
  FLASHLIST_DEFAULTS,
} from '#utils/flashListDefaults';

// Extracted modules
import {
  DRAW_DISTANCE,
  MVCP_DISABLED,
  DEFAULT_PANTRY_TABS,
} from './pantryDisplay/constants';
import {
  computeDisplayMap,
  DisplayMapContext,
  getLocationString,
} from './pantryDisplay/displayMapCache';
import { renderItem } from './pantryDisplay/renderItem';
import { PantryEmptyState } from './PantryEmptyState';
import type {
  ExpirationColors,
  PantryContentProps,
  PantryContentRef,
} from './pantryDisplay/types';

type PantryListItem = PantryItem | StickyHeaderSentinel;

// Module-level flag: once pantry content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasEverShownContent = false;

// --- Main component ---

export const PantryContent = React.forwardRef<
  PantryContentRef,
  PantryContentProps
>(
  (
    {
      userName,
      householdName,
      avatarUrl,
      notificationCount = 0,
      stats,
      items,
      locationFilter,
      onLocationFilterChange,
      locationCounts,
      tabs = DEFAULT_PANTRY_TABS,
      onAddLocation,
      searchQuery,
      onSearchChange,
      initialSortOption = 'recent',
      initialSortDirection = 'desc',
      onSortChange,
      useServerSort = false,
      onItemPress,
      onItemEdit,
      onItemDelete,
      onItemConsume,
      onItemWaste,
      onItemRestock,
      onAvatarPress,
      onHomePress,
      onNotificationPress,
      onSettingsPress,
      onAnalyticsPress,
      onLowStockNavigate,
      onExpiringNavigate,
      totalCount,
      onAddItem,
      hasMore = false,
      onRefresh,
      onEndReached,
      refreshing = false,
      loading = false,
      noHomeSelected,
      noHomes,
      noPantries,
      onSelectHome,
      onCreatePantry,
      onHomeBadgeLayout,
      onSettingsIconLayout,
      scrollHandler,
      onScrollEndDrag,
      onMomentumScrollEnd,
    },
    ref,
  ) => {
    useRenderTime('PantryContent', { slowThreshold: 1000 });
    // KEEP useUnistyles: theme colors flow into computeDisplayMap data — not
    // stylesheets — so the values are passed through to per-item ExpirationText
    // via `style={{ color }}`. They cannot be expressed as stylesheet variants.
    const { theme } = useUnistyles();
    const { bottom: safeBottom } = useSafeAreaInsets();
    const flashListRef = useRef<FlashListRef<PantryListItem>>(null);
    const settingsIconRef = useRef<View>(null);

    const perfCallbacks = useFlashListPerformance(flashListRef, {
      componentName: 'PantryContent',
      reportInterval: 10000,
    });
    useDataReferenceTracker(
      items,
      'PantryContent.items',
      perfCallbacks.onDataReferenceChange,
    );

    useImperativeHandle(ref, () => ({
      scrollToTop() {
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToTop({ animated: true });
        });
      },
    }));

    // Derive latch from module-level flag + current conditions — no setState needed.
    const hasShownContent =
      hasEverShownContent || (!loading && items.length > 0);

    useEffect(() => {
      if (hasShownContent) {
        hasEverShownContent = true;
      }
    }, [hasShownContent]);

    const awaitingDeferredItems =
      items.length === 0 && (totalCount ?? 0) > 0 && !loading;
    const showSkeletons =
      !hasShownContent && (loading || awaitingDeferredItems);

    const {
      sortOption,
      sortDirection,
      sortModalVisible,
      openSortModal,
      closeSortModal,
      handleSortSelect,
      sortItems,
    } = usePantrySorting<PantryItem>({
      initialSortOption,
      initialSortDirection,
      onSortChange,
    });

    const itemActions: PantryItemActions = {
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
    };

    const localFilteredItems = items;
    const sortedItems = useServerSort
      ? localFilteredItems
      : sortItems(localFilteredItems);

    const deferredSortedItems = useDeferredValue(sortedItems);

    const listData: PantryListItem[] = showSkeletons
      ? [STICKY_HEADER_SENTINEL]
      : [STICKY_HEADER_SENTINEL, ...deferredSortedItems];

    useDataReferenceTracker(
      sortedItems,
      'PantryContent.sortedItems',
      perfCallbacks.onDataReferenceChange,
    );

    // Precomputed theme colors — used by computeDisplayMap.
    const expirationColors: ExpirationColors = {
      expired: theme.colors.expiration.expiredText,
      warning: theme.colors.expiration.warningText,
      normal: theme.colors.textSecondary,
    };

    const displayMap = computeDisplayMap(
      sortedItems,
      expirationColors,
      getLocationString,
    );

    useEffect(() => {
      const urls: string[] = [];
      for (const item of sortedItems) {
        const display = displayMap.get(item.id);
        if (display?.imageUrl) urls.push(display.imageUrl);
      }
      if (urls.length === 0) return;

      const handle = requestIdleCallback(() => {
        preloadImages(urls);
      });
      return () => cancelIdleCallback(handle);
    }, [sortedItems, displayMap]);

    const prevLocationFilter = useRef(locationFilter);
    const prevSortOption = useRef(sortOption);
    const prevSortDirection = useRef(sortDirection);
    useEffect(() => {
      const changed =
        prevLocationFilter.current !== locationFilter ||
        prevSortOption.current !== sortOption ||
        prevSortDirection.current !== sortDirection;

      if (changed) {
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
        prevLocationFilter.current = locationFilter;
        prevSortOption.current = sortOption;
        prevSortDirection.current = sortDirection;
      }
    }, [locationFilter, sortOption, sortDirection]);

    const tabsWithAddButton = (() => {
      if (!onAddLocation) return tabs;
      return [
        ...tabs,
        {
          id: '__add__' as LocationFilter,
          label: '',
          icon: 'add',
          onPress: onAddLocation,
          isAction: true,
        },
      ];
    })();

    const extraData = `${sortOption}-${sortDirection}-${locationFilter}`;

    const isEmpty = !showSkeletons && sortedItems.length === 0;

    const listContentStyle = isEmpty
      ? styles.listContentEmpty
      : {
          paddingHorizontal: 0,
          paddingBottom: getTabBarBottomPadding(safeBottom),
        };

    const getListItemType = (item: PantryListItem) => {
      if (isStickyHeaderSentinel(item)) return 'stickyHeader';
      return 'item';
    };

    const listKeyExtractor = (item: PantryListItem) => {
      if (isStickyHeaderSentinel(item)) return '__stickyHeader__';
      return item.id;
    };

    const renderListItem = ({
      item,
      index,
      target,
      extraData: extra,
    }: ListRenderItemInfo<PantryListItem>) => {
      if (isStickyHeaderSentinel(item)) {
        return (
          <View
            style={[
              styles.stickySection,
              target === 'StickyHeader' && styles.stickyHeaderActive,
            ]}
          >
            <FilterTabs<LocationFilter>
              tabs={tabsWithAddButton}
              activeTabId={locationFilter}
              onTabChange={onLocationFilterChange}
              counts={locationCounts}
              testIDPrefix="pantry-location-tab"
            />
          </View>
        );
      }

      return renderItem({ item, index: index - 1, target, extraData: extra });
    };

    return (
      <PantryActionsProvider actions={itemActions}>
        <View style={styles.container}>
          <View style={styles.listContainer}>
            <View style={styles.contentFill}>
              <DisplayMapContext.Provider value={displayMap}>
                <FlashList<PantryListItem>
                  ref={flashListRef}
                  CellRendererComponent={AnimatedCellRenderer}
                  testID="pantry-list"
                  data={listData}
                  renderItem={renderListItem}
                  keyExtractor={listKeyExtractor}
                  getItemType={getListItemType}
                  stickyHeaderIndices={STICKY_HEADER_INDICES}
                  stickyHeaderConfig={STICKY_HEADER_CONFIG}
                  drawDistance={DRAW_DISTANCE}
                  maxItemsInRecyclePool={15}
                  extraData={extraData}
                  contentContainerStyle={listContentStyle}
                  showsVerticalScrollIndicator={false}
                  onScroll={scrollHandler}
                  onScrollEndDrag={onScrollEndDrag}
                  onMomentumScrollEnd={onMomentumScrollEnd}
                  scrollEventThrottle={16}
                  refreshControl={
                    onRefresh ? (
                      <RefreshControl
                        testID="pantry-refresh-control"
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        progressViewOffset={100}
                      />
                    ) : undefined
                  }
                  ListHeaderComponent={
                    <>
                      <View style={styles.header}>
                        <PantryHeader
                          userName={userName}
                          householdName={householdName}
                          avatarUrl={avatarUrl}
                          notificationCount={notificationCount}
                          onAvatarPress={onAvatarPress}
                          onHomePress={onHomePress}
                          onNotificationPress={onNotificationPress}
                          onHomeBadgeLayout={onHomeBadgeLayout}
                        />
                      </View>
                      <View style={styles.searchContainer}>
                        <SearchBar
                          value={searchQuery}
                          onChangeText={onSearchChange}
                          placeholder="Search your pantry..."
                          showSearchIcon={true}
                          testID="pantry-search-input"
                          innerRightIcon={
                            <View
                              ref={settingsIconRef}
                              collapsable={false}
                              onLayout={() => {
                                if (onSettingsIconLayout) {
                                  requestAnimationFrame(() => {
                                    settingsIconRef.current?.measure(
                                      (_x, _y, w, h, pageX, pageY) => {
                                        if (w > 0 && h > 0) {
                                          onSettingsIconLayout({
                                            x: pageX,
                                            y: pageY,
                                            width: w,
                                            height: h,
                                          });
                                        }
                                      },
                                    );
                                  });
                                }
                              }}
                            >
                              <Pressable
                                onPress={onSettingsPress}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Pantry settings"
                              >
                                <Icon
                                  name="settings-outline"
                                  size={18}
                                  tone="textTertiary"
                                />
                              </Pressable>
                            </View>
                          }
                        />
                        {!!stats && (
                          <PantryAlertBar
                            stats={stats}
                            onAnalyticsPress={onAnalyticsPress}
                            onLowStockNavigate={onLowStockNavigate}
                            onExpiringNavigate={onExpiringNavigate}
                            sortLabel={`Sort ${
                              sortDirection === 'asc' ? '↑' : '↓'
                            }`}
                            onSortPress={openSortModal}
                          />
                        )}
                      </View>
                    </>
                  }
                  ListFooterComponent={
                    isEmpty ? (
                      <PantryEmptyState
                        showSkeletons={showSkeletons}
                        searchQuery={searchQuery}
                        itemCount={items.length}
                        locationFilter={locationFilter}
                        tabs={tabs}
                        onAddItem={onAddItem}
                        noHomeSelected={noHomeSelected}
                        noHomes={noHomes}
                        noPantries={noPantries}
                        onSelectHome={onSelectHome}
                        onCreatePantry={onCreatePantry}
                        overallItemCount={locationCounts.all ?? 0}
                      />
                    ) : (
                      <PaginationFooter
                        hasMore={hasMore}
                        itemCount={deferredSortedItems.length}
                        SkeletonComponent={PantryItemSkeleton}
                        skeletonCount={3}
                      />
                    )
                  }
                  onEndReached={onEndReached}
                  onEndReachedThreshold={
                    FLASHLIST_DEFAULTS.analyticsHeavyFullScreen
                      .onEndReachedThreshold
                  }
                  onLoad={perfCallbacks.onLoad}
                  onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
                  maintainVisibleContentPosition={MVCP_DISABLED}
                />
              </DisplayMapContext.Provider>
            </View>
          </View>

          {!!sortModalVisible && (
            <PantrySortModal
              visible={sortModalVisible}
              sortOption={sortOption}
              sortDirection={sortDirection}
              onSelect={handleSortSelect}
              onClose={closeSortModal}
            />
          )}
        </View>
      </PantryActionsProvider>
    );
  },
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  stickySection: {
    backgroundColor: theme.colors.background,
    zIndex: theme.zIndex.sticky,
    paddingBottom: theme.spacing.sm,
  },
  stickyHeaderActive: {
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
  listContainer: {
    flex: 1,
  },
  contentFill: {
    flex: 1,
  },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
}));
