import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import {
  Pressable,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import { getTabBarBottomPadding } from '#constants/layout';
import { Icon } from '#utils/iconUtils';
import { LocationFilter } from '#features/pantry/utils/pantryFilters';
import {
  PantrySortDirection,
  PREFERENCE_DEFAULTS,
} from '#store/slices/preferenceTypes';
import { SearchBar } from '#components/molecules/SearchBar';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import { PantryAlertBar } from '#features/pantry/components/PantryAlertBar';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';
import { usePantryImagePreload } from '#features/pantry/hooks/usePantryImagePreload';
import { useOverlayBackdropPresence } from '#components/providers/OverlayBackdropProvider';
import { useCommitTracking } from '#hooks/performance/useCommitTracking';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import {
  FLASHLIST_DEFAULTS,
  STICKY_HEADER_SENTINEL,
  STICKY_HEADER_INDICES,
  STICKY_HEADER_CONFIG,
} from '#utils/flashListDefaults';

import {
  DRAW_DISTANCE,
  MVCP_DISABLED,
  getDefaultPantryTabs,
} from './pantryDisplay/constants';
import {
  renderPantryListItem,
  getPantryListItemType,
  pantryListKeyExtractor,
  type PantryListItem,
  type PantryListNode,
} from './pantryDisplay/renderItem';
import { PantryStickyTabsProvider } from './pantryDisplay/PantryStickyTabs';
import { PantryEmptyState } from './PantryEmptyState';
import { PantryListSkeletonOverlay } from './PantryListSkeletonOverlay';
import type {
  PantryContentProps,
  PantryContentRef,
} from './pantryDisplay/types';

// Survives unmount/remount (stack navigation) so a return visit skips the
// skeletons; resets on app restart.
let hasEverShownContent = false;

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
      tabs,
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
      isLoadingMore = false,
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
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollEnd,
    },
    ref,
  ) => {
    useCommitTracking('PantryContent');
    const { t } = useTranslation();
    const { bottom: safeBottom } = useSafeAreaInsets();
    const flashListRef = useRef<FlashListRef<PantryListItem>>(null);
    const settingsIconRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
      scrollToTop() {
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToTop({ animated: true });
        });
      },
    }));

    const hasShownContent =
      hasEverShownContent || (!loading && items.length > 0);

    useEffect(() => {
      if (hasShownContent) {
        hasEverShownContent = true;
      }
    }, [hasShownContent]);

    // Stats-backed: `pantry.stats` survives when `itemsConnection` reads empty
    // (dangling edge refs, offline cold start), where its `totalCount` is 0 —
    // so the connection's own count can't be the wait signal.
    const expectedCount = locationCounts?.[locationFilter] ?? totalCount ?? 0;

    // "Expected here but not arrived yet". Gating on `loading` is what stops
    // this sticking: once the query settles the list is authoritative, so an
    // emptied tab whose stale stats still report a count reaches the real empty
    // state. Search and the no-home/no-pantry states are excluded — their own
    // empty states must win.
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

    // Goes to FlashList whole, and never through `useDeferredValue`: FlashList
    // truncates its layout table during render and re-indexes cells only at
    // commit, so an interruptible render lets a native `onLayout` land between
    // the two and throw "index out of bounds, not enough layouts" — fatal in
    // release (docs/flashlist-layout-index-race.md). There is deliberately no
    // local render window either; DRAW_DISTANCE alone bounds the mounted set.
    const sortedItems = useServerSort ? items : sortItems(items);

    // A tab switch whose new page is still fetching (server mode only). Cleared
    // only on a true→false `fetching` transition, never when fetching was
    // already false at press time — the Apollo refetch is one render behind.
    const [switching, setSwitching] = useState(false);
    const [prevFetching, setPrevFetching] = useState(fetching);
    if (prevFetching !== fetching) {
      setPrevFetching(fetching);
      if (switching && prevFetching && !fetching) setSwitching(false);
    }
    // Client mode never fetches on switch, so an armed latch would wait on a
    // transition that never comes and blank a valid list later. Drop it.
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

    // A sort change rebuilds the row order, so a kept offset would land on an
    // arbitrary slice. Tab switches intentionally keep their position instead
    // (rows swap in place under the sticky tabs).
    useEffect(() => {
      const handle = requestAnimationFrame(() => {
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
      return () => cancelAnimationFrame(handle);
    }, [sortOption, sortDirection]);

    // Gated on the UN-SMOOTHED loading signal: items reach FlashList the moment
    // they exist, and the anti-flash minimum lives on the overlay instead, so a
    // fast load is never delayed by presentation smoothing.
    const initialSkeletons = awaitingItems || (!hasShownContent && loading);
    const switchSkeletons = switching && fetching;
    const showSkeletons = initialSkeletons || switchSkeletons;

    // While skeletons show, hand the list only the sticky tabs: chrome and tabs
    // stay visible, and stale rows from a previous tab can't flash through.
    const bodyItems = showSkeletons ? [] : sortedItems;
    const nextListData: PantryListItem[] = [
      STICKY_HEADER_SENTINEL,
      ...bodyItems,
    ];
    const isEmpty = bodyItems.length === 0;

    // Hold the ROWS still while a sheet covers them: every pantry write flips
    // this array's identity and FlashList re-renders every mounted cell for it,
    // invisibly behind the sheet. Only the rows freeze — the header reads
    // `bodyItems`/`stats` directly, so counts still tick up live. Ordinary
    // state, deliberately NOT `useDeferredValue`/`startTransition` (see the
    // layout-index race above): this changes WHEN the prop updates, not how.
    const overlayCoversRows = useOverlayBackdropPresence();
    const [heldListData, setHeldListData] = useState(nextListData);
    if (!overlayCoversRows && heldListData !== nextListData) {
      setHeldListData(nextListData);
    }
    const listData = overlayCoversRows ? heldListData : nextListData;

    // `hasRealContent` latches `app_fully_drawn_ms`, so it reads the UN-SMOOTHED
    // `initialSkeletons`, never a presentation flag: a presentation flag would
    // put smoothing under the metric as a floor, and would deadlock the overlay
    // (its release needs `hasContentLayout`, which only arms while this is
    // true). A settled empty tab counts as content — `initialSkeletons` is
    // false by then.
    const perfCallbacks = useFlashListPerformance(flashListRef, {
      componentName: 'PantryContent',
      reportInterval: 10000,
      hasRealContent: !initialSkeletons,
      rowCount: listData.length,
    });
    // FlashList re-renders EVERY mounted cell when this prop's identity changes,
    // so it must never change: the live handler (which flips to `undefined` as
    // `hasMore` changes) is read from a ref at call time, never during render.
    const onEndReachedRef = useRef(onEndReached);
    useEffect(() => {
      onEndReachedRef.current = onEndReached;
    }, [onEndReached]);
    const handleEndReached = () => {
      onEndReachedRef.current?.();
    };

    useDataReferenceTracker(
      items,
      'PantryContent.items',
      perfCallbacks.onDataReferenceChange,
    );

    // The blank-window cover: FlashList holds every cell invisible until its
    // first layout commits while the header chrome paints immediately, so the
    // cover mounts inside ListHeaderComponent from the FIRST commit and
    // releases on `hasContentLayout`, which `rowCount` resolves for an empty
    // tab. No `useMinimumVisible` — the exit fade is the anti-flash smoothing.
    const overlayVisible = initialSkeletons || !perfCallbacks.hasContentLayout;

    // The overlay covers the whole list area, so the footer renders NOTHING
    // beneath it: its own skeleton rows start from a different origin (two
    // offset sets of shimmer) and its empty state shows through the flap.
    const footerVisible = !overlayVisible;

    useDataReferenceTracker(
      sortedItems,
      'PantryContent.sortedItems',
      perfCallbacks.onDataReferenceChange,
    );

    usePantryImagePreload(sortedItems);

    // The switch skeleton applies to server-mode fetches only; client-mode
    // switches are instant and never arm the latch.
    const handleLocationFilterChange = (id: LocationFilter) => {
      if (id !== locationFilter && serverMode) setSwitching(true);
      onLocationFilterChange(id);
    };

    const resolvedTabs = tabs ?? getDefaultPantryTabs();

    const tabsWithAddButton = (() => {
      if (!onAddLocation) return resolvedTabs;
      return [
        ...resolvedTabs,
        {
          id: '__add__' as LocationFilter,
          label: '',
          icon: 'add',
          onPress: onAddLocation,
          isAction: true,
        },
      ];
    })();

    // `locationFilter` is deliberately absent: no item cell renders anything
    // derived from it, and including it re-renders every mounted cell on a tab
    // change.
    const extraData = `${sortOption}-${sortDirection}`;

    const listContentStyle = isEmpty
      ? styles.listContentEmpty
      : {
          paddingHorizontal: 0,
          paddingBottom: getTabBarBottomPadding(safeBottom),
        };

    // Read from context, not from `renderItem`'s closure — see
    // `PantryStickyTabs` for why that matters to every other cell.
    const stickyTabs = {
      tabs: tabsWithAddButton,
      activeTabId: locationFilter,
      onTabChange: handleLocationFilterChange,
      counts: locationCounts,
    };

    return (
      <PantryActionsProvider actions={itemActions}>
        <PantryStickyTabsProvider value={stickyTabs}>
          <View style={styles.container}>
            <FlashList<PantryListItem>
              renderScrollComponent={SwipeAwareScrollComponent}
              ref={flashListRef}
              CellRendererComponent={perfCallbacks.CellRendererComponent}
              testID="pantry-list"
              data={listData}
              renderItem={renderPantryListItem}
              keyExtractor={pantryListKeyExtractor}
              getItemType={getPantryListItemType}
              stickyHeaderIndices={STICKY_HEADER_INDICES}
              stickyHeaderConfig={STICKY_HEADER_CONFIG}
              drawDistance={DRAW_DISTANCE}
              maxItemsInRecyclePool={15}
              extraData={extraData}
              contentContainerStyle={listContentStyle}
              showsVerticalScrollIndicator={false}
              onScroll={scrollHandler}
              onScrollBeginDrag={onScrollBeginDrag}
              onScrollEndDrag={onScrollEndDrag}
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={16}
              refreshControl={
                onRefresh ? (
                  <ThemedRefreshControl
                    testID="pantry-refresh-control"
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                ) : undefined
              }
              ListHeaderComponent={
                // The positioned parent the skeleton flap anchors to
                // (`top: '100%'`, flush below the chrome).
                <View>
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
                            accessibilityLabel={t('labels.pantrySettings')}
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
                  {overlayVisible ? <PantryListSkeletonOverlay /> : null}
                </View>
              }
              ListFooterComponent={
                !footerVisible ? null : isEmpty ? (
                  <PantryEmptyState
                    showSkeletons={showSkeletons}
                    searchQuery={searchQuery}
                    itemCount={items.length}
                    locationFilter={locationFilter}
                    tabs={resolvedTabs}
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
                    isFetchingMore={isLoadingMore}
                    itemCount={bodyItems.length}
                    SkeletonComponent={PantryItemSkeleton}
                    skeletonCount={3}
                  />
                )
              }
              onEndReached={handleEndReached}
              onEndReachedThreshold={
                FLASHLIST_DEFAULTS.analyticsHeavyFullScreen
                  .onEndReachedThreshold
              }
              onLoad={perfCallbacks.onLoad}
              onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
              onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
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
        </PantryStickyTabsProvider>
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
  // `stickyHeaderActive` applies while pinned, so the row keeps an opaque
  // background and rows scroll cleanly underneath.
  stickySection: {
    backgroundColor: theme.colors.background,
    zIndex: theme.zIndex.sticky,
    paddingBottom: theme.spacing.sm,
  },
  stickyHeaderActive: {
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.base,
  },
  statsContainer: {
    paddingHorizontal: theme.spacing.base,
  },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
}));
