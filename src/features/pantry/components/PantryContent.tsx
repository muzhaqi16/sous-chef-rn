import React, {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import { View, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useApolloClient } from '@apollo/client/react';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { getTabBarBottomPadding } from '#constants/layout';
import { Icon } from '#utils/iconUtils';
import { LocationFilter } from '#features/pantry/utils/pantryFilters';
import {
  PantrySortDirection,
  PREFERENCE_DEFAULTS,
} from '#store/slices/preferenceTypes';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import {
  PantryContent_PantryItemFragmentDoc,
  type PantryContent_PantryItemFragment,
} from './PantryContent.generated';
import { PantryAlertBar } from '#features/pantry/components/PantryAlertBar';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { preloadImages } from '#components/atoms/CachedImage';
import { resolveImageUrl } from '#utils/imageUtils';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import {
  FLASHLIST_DEFAULTS,
  STICKY_HEADER_SENTINEL,
  STICKY_HEADER_INDICES,
  STICKY_HEADER_CONFIG,
  isStickyHeaderSentinel,
  type StickyHeaderSentinel,
} from '#utils/flashListDefaults';

// Extracted modules
import {
  DRAW_DISTANCE,
  MVCP_DISABLED,
  DEFAULT_PANTRY_TABS,
  INITIAL_RENDER_WINDOW,
  RENDER_WINDOW_STEP,
} from './pantryDisplay/constants';
import { renderItem, type PantryListNode } from './pantryDisplay/renderItem';
import { PantryEmptyState } from './PantryEmptyState';
import type {
  PantryContentProps,
  PantryContentRef,
} from './pantryDisplay/types';

// Module-level flag: once pantry content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasEverShownContent = false;

// The list is a heterogeneous array: a single sticky sentinel at index 0 (the
// filter tabs, pinned natively via `stickyHeaderIndices`) followed by item rows.
type PantryListItem = StickyHeaderSentinel | PantryListNode;

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
      initialSortOption = PREFERENCE_DEFAULTS.pantrySortOption,
      initialSortDirection = PREFERENCE_DEFAULTS.pantrySortDirection,
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
      onExpiredNavigate,
      totalCount,
      onAddItem,
      hasMore = false,
      onRefresh,
      onEndReached,
      refreshing = false,
      loading = false,
      fetching = false,
      serverMode = false,
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
    const { t } = useTranslation();
    const { bottom: safeBottom } = useSafeAreaInsets();
    // Apollo cache reads run inside the image-preload effect; each leaf
    // computes its own display data via `useFragment`.
    const client = useApolloClient();
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

    // Expected item count for the ACTIVE tab, read from the stats-backed
    // `locationCounts`. `pantry.stats` is a separate field that survives when
    // `itemsConnection` reads empty (the connection's own `totalCount` is 0 in
    // that case — e.g. dangling edge refs filtered by the cache read policy, or
    // an offline cold-start — so it can't be the wait signal).
    const expectedCount = locationCounts?.[locationFilter] ?? totalCount ?? 0;

    // "Items are expected here but haven't arrived yet" — show skeletons while
    // the query is still settling (`loading` is `isLoadingInitial`: true only
    // while items are empty AND the query is in-flight/not-ready). Gating on
    // `loading` is what keeps this from sticking: once the query settles the
    // list is authoritative, so an emptied tab (e.g. last item removed offline,
    // where stale stats still report a count) falls through to the real empty
    // state instead of skeletons forever. Excluded: an active search (empty =
    // "no results") and the no-home/no-pantry states (their own empty states
    // must win even if stale stats linger).
    const awaitingItems =
      loading &&
      items.length === 0 &&
      expectedCount > 0 &&
      !searchQuery &&
      !noHomeSelected &&
      !noHomes &&
      !noPantries;

    const {
      sortOption,
      sortDirection,
      sortModalVisible,
      openSortModal,
      closeSortModal,
      handleSortSelect,
      sortItems,
    } = usePantrySorting<PantryListNode>({
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

    const sortedItems = useServerSort ? items : sortItems(items);
    const deferredSortedItems = useDeferredValue(sortedItems);

    // Client-side render window: hand FlashList only a growing slice of the
    // loaded set so it never mounts the whole load-all page (~100 cells) at once.
    // Reset to the initial window whenever the view changes (tab / sort / search)
    // so a fresh view starts light — done during render (no effect) so listData
    // is correct on the same commit. Server pagination still drives `onEndReached`
    // when there are more pages to fetch; otherwise we grow the window locally.
    const [clientWindow, setClientWindow] = useState(INITIAL_RENDER_WINDOW);
    const windowSignature = `${locationFilter}|${sortOption}|${sortDirection}|${searchQuery}`;
    const [prevWindowSignature, setPrevWindowSignature] =
      useState(windowSignature);
    if (prevWindowSignature !== windowSignature) {
      setPrevWindowSignature(windowSignature);
      setClientWindow(INITIAL_RENDER_WINDOW);
    }

    const windowedItems = deferredSortedItems.slice(0, clientWindow);
    const clientHasMore = clientWindow < deferredSortedItems.length;

    // A tab switch whose new page is still fetching (server mode only): armed on
    // press, cleared once `fetching` transitions true→false. Cleared only on
    // that transition (not when fetching was already false at press time) to
    // avoid a race where the Apollo refetch is one render behind setSwitching.
    const [switching, setSwitching] = useState(false);
    const [prevFetching, setPrevFetching] = useState(fetching);
    if (prevFetching !== fetching) {
      setPrevFetching(fetching);
      if (switching && prevFetching && !fetching) setSwitching(false);
    }
    // Client mode never fetches on switch, so an armed latch could only clear
    // via a fetching transition that never comes — and would then blank a
    // valid list when server mode kicks in later. Drop it outside server mode.
    if (switching && !serverMode) {
      setSwitching(false);
    }

    // Server-mode sort changes refetch the page in the new order — arm the
    // same switch skeleton so the stale ordering doesn't linger un-covered.
    const sortSignature = `${sortOption}|${sortDirection}`;
    const [prevSortSignature, setPrevSortSignature] = useState(sortSignature);
    if (prevSortSignature !== sortSignature) {
      setPrevSortSignature(sortSignature);
      if (serverMode) setSwitching(true);
    }

    // A sort change rebuilds the row order and collapses the client render
    // window, so a kept scroll offset would land on an arbitrary slice —
    // restart from the top. Tab switches intentionally keep their position
    // (rows swap in place under the sticky tabs). The mount run is a no-op
    // (offset is already 0).
    useEffect(() => {
      requestAnimationFrame(() => {
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, [sortOption, sortDirection]);

    // Items exist but the deferred/windowed slice hasn't caught up yet — a
    // one-render `useDeferredValue` lag on the empty→populated transition.
    // Skeletons bridge it until the rows are in the window. Transient by
    // construction (the deferred value always catches up next render).
    const renderLag = sortedItems.length > 0 && windowedItems.length === 0;
    const showSkeletons =
      awaitingItems ||
      renderLag ||
      (!hasShownContent && loading) ||
      (switching && fetching);

    // While skeletons show, hand the list only the sticky tabs so the chrome +
    // tabs stay visible with skeleton rows below (PantryEmptyState) — and any
    // stale rows from a previous tab don't flash through.
    const bodyItems = showSkeletons ? [] : windowedItems;
    const listData: PantryListItem[] = [STICKY_HEADER_SENTINEL, ...bodyItems];
    const isEmpty = bodyItems.length === 0;

    // End-reached: fetch the next server page if one exists, otherwise grow the
    // local window. `onEndReached` (prop) is defined only when the server has
    // more pages; below the load window it's undefined and we reveal locally.
    const handleEndReached = () => {
      if (onEndReached) {
        onEndReached();
        return;
      }
      if (clientWindow < deferredSortedItems.length) {
        setClientWindow(w =>
          Math.min(w + RENDER_WINDOW_STEP, deferredSortedItems.length),
        );
      }
    };

    const hasMoreToRender = hasMore || clientHasMore;

    useDataReferenceTracker(
      sortedItems,
      'PantryContent.sortedItems',
      perfCallbacks.onDataReferenceChange,
    );

    // Image preloading — fragment refs don't carry field data at runtime
    // (Apollo masks them), so unmask via `cache.readFragment` here to extract
    // image URLs. This is a one-shot read inside an idle callback, not a
    // render-path subscription.
    useEffect(() => {
      if (sortedItems.length === 0) return;

      const handle = requestIdleCallback(() => {
        const urls: string[] = [];
        // Only preload images for the items actually rendered (the current
        // window), not the entire loaded set.
        for (const node of sortedItems.slice(0, clientWindow)) {
          const item =
            client.cache.readFragment<PantryContent_PantryItemFragment>({
              fragment: PantryContent_PantryItemFragmentDoc,
              fragmentName: 'PantryContent_pantryItem',
              from: node,
            });
          if (!item) continue;
          const url = resolveImageUrl(item);
          if (url) urls.push(url);
        }
        if (urls.length > 0) {
          preloadImages(urls);
        }
      });
      return () => cancelIdleCallback(handle);
    }, [sortedItems, clientWindow, client]);

    // Tab switch maintains the scroll position and swaps the rows below the
    // sticky tabs in place. The switch skeleton only applies to server-mode
    // fetches; client-mode switches are instant and never arm the latch.
    const handleLocationFilterChange = (id: LocationFilter) => {
      if (id !== locationFilter && serverMode) setSwitching(true);
      onLocationFilterChange(id);
    };

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

    // Re-render rows (and the active-tab highlight) when sort/filter changes.
    const extraData = `${sortOption}-${sortDirection}-${locationFilter}`;

    const listContentStyle = isEmpty
      ? styles.listContentEmpty
      : {
          paddingHorizontal: 0,
          paddingBottom: getTabBarBottomPadding(safeBottom),
        };

    const getListItemType = (item: PantryListItem) =>
      isStickyHeaderSentinel(item) ? 'stickyHeader' : 'item';

    const listKeyExtractor = (item: PantryListItem) =>
      isStickyHeaderSentinel(item) ? '__stickyHeader__' : item.id;

    // Inline renderItem (compiler-memoized) so the sticky tabs can read the
    // current filter/handlers; item rows delegate to the shared leaf renderer.
    const renderListItem = (info: ListRenderItemInfo<PantryListItem>) => {
      const { item, target } = info;
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
              onTabChange={handleLocationFilterChange}
              counts={locationCounts}
              testIDPrefix="pantry-location-tab"
            />
          </View>
        );
      }
      return renderItem({ ...info, item });
    };

    return (
      <PantryActionsProvider actions={itemActions}>
        <View style={styles.container}>
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
                    placeholder={t('pantryScreen.searchPlaceholder')}
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
                          accessibilityLabel={t(
                            'pantryScreen.settingsAccessibility',
                          )}
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
                </View>
                {!!stats && (
                  <View style={styles.statsContainer}>
                    <PantryAlertBar
                      stats={stats}
                      onAnalyticsPress={onAnalyticsPress}
                      onLowStockNavigate={onLowStockNavigate}
                      onExpiringNavigate={onExpiringNavigate}
                      onExpiredNavigate={onExpiredNavigate}
                      sortLabel={`${t('pantryScreen.sort')} ${
                        sortDirection === PantrySortDirection.ASC ? '↑' : '↓'
                      }`}
                      onSortPress={openSortModal}
                    />
                  </View>
                )}
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
                  hasMore={hasMoreToRender}
                  itemCount={bodyItems.length}
                  SkeletonComponent={PantryItemSkeleton}
                  skeletonCount={3}
                />
              )
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={
              FLASHLIST_DEFAULTS.analyticsHeavyFullScreen.onEndReachedThreshold
            }
            onLoad={perfCallbacks.onLoad}
            onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
            maintainVisibleContentPosition={MVCP_DISABLED}
          />

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
  // The sticky tabs row. `stickyHeaderActive` is applied while it's pinned so it
  // keeps an opaque background and the rows scroll cleanly underneath.
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
  statsContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
}));
