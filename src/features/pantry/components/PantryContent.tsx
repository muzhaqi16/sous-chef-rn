import { pantryTestIDs } from '#features/pantry/testIDs';
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
import { getScrollClearancePadding } from '#constants/layout';
import { Icon } from '#utils/iconUtils';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import {
  PantrySortDirection,
  PREFERENCE_DEFAULTS,
} from '#store/slices/preferenceTypes';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/organisms/FilterTabs/FilterTabs';
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
import { RowReflowContext, useRowReflow } from '#hooks/animations/useRowReflow';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

import {
  DRAW_DISTANCE,
  MVCP_DISABLED,
  getDefaultPantryTabs,
} from './pantryDisplay/constants';
import {
  renderItem,
  pantryListKeyExtractor,
  type PantryListNode,
} from './pantryDisplay/renderItem';
import { PantryEmptyState } from './PantryEmptyState';
import { PantryListSkeletonOverlay } from './PantryListSkeletonOverlay';
import type {
  PantryContentProps,
  PantryContentRef,
} from './pantryDisplay/types';
import { hitSlop } from '#/theme/foundations/sizes';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';

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
      itemsFailure,
      fetching = false,
      searching = false,
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
    const flashListRef = useRef<FlashListRef<PantryListNode>>(null);
    const reflow = useRowReflow(flashListRef, onScrollBeginDrag);
    const { ref: settingsIconRef, measure: measureSettingsIcon } =
      useMeasuredRect(onSettingsIconLayout);

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
    const expectedCount = locationCounts[locationFilter] ?? totalCount ?? 0;

    // Expected but not arrived. Only while `loading`: a settled list is
    // authoritative, so stale stats cannot hold an emptied tab off its empty
    // state. Search and no-home/no-pantry show their own.
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
            reflow.removeRow(() => onItemDelete(id));
          }
        : undefined,
      onItemConsume,
      onItemWaste,
      onItemRestock,
    };

    // Whole to FlashList, never via `useDeferredValue`: an interruptible render
    // throws "not enough layouts" (docs/flashlist-layout-index-race.md).
    // DRAW_DISTANCE bounds the mounted set.
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
    // (rows swap in place under the tabs).
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
    // Until a server search answers, an empty list is not "no results".
    const searchSkeletons = searching && items.length === 0;
    const showSkeletons =
      initialSkeletons || switchSkeletons || searchSkeletons;

    // While skeletons show, hand the list no rows, so stale rows from a
    // previous tab can't flash through.
    const bodyItems = showSkeletons ? [] : sortedItems;
    const nextListData = bodyItems;
    const isEmpty = bodyItems.length === 0;

    // The ROWS hold still under a sheet, where each write would re-render every
    // mounted cell unseen; the header reads `bodyItems`/`stats`, so counts stay
    // live. Plain state, not a deferred value (the race above).
    const overlayCoversRows = useOverlayBackdropPresence();
    const [heldListData, setHeldListData] = useState(nextListData);
    if (!overlayCoversRows && heldListData !== nextListData) {
      setHeldListData(nextListData);
    }
    const listData = overlayCoversRows ? heldListData : nextListData;

    // `hasRealContent` latches `app_fully_drawn_ms` and reads raw
    // `initialSkeletons`: a presentation flag would floor the metric and
    // deadlock the overlay, released by the `hasContentLayout` this arms.
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

    // FlashList hides every cell until its first layout, so this cover renders
    // from the list's FIRST commit and releases on `hasContentLayout`
    // (`rowCount` when empty). The exit fade is the anti-flash smoothing.
    const overlayVisible = initialSkeletons || !perfCallbacks.hasContentLayout;

    // The footer renders NOTHING while the overlay is up: it would paint over
    // the overlay, its skeleton rows as a second offset set of shimmer and its
    // empty state as "empty" over a loading list.
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

    const resolvedTabs = tabs ?? getDefaultPantryTabs(t);

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
      : [
          styles.listContent,
          { paddingBottom: getScrollClearancePadding(safeBottom) },
        ];

    const settingsIcon = (
      <View
        ref={settingsIconRef}
        collapsable={false}
        onLayout={measureSettingsIcon}
      >
        <Pressable
          onPress={onSettingsPress}
          hitSlop={hitSlop.md}
          accessibilityRole="button"
          accessibilityLabel={t('labels.pantrySettings')}
        >
          <Icon name="settings-outline" size={18} tone="textTertiary" />
        </Pressable>
      </View>
    );

    return (
      <PantryActionsProvider actions={itemActions}>
        <View style={styles.container}>
          {/* Above the list, not inside it: the spinner drops from the list's
              top, as on every other tab. */}
          <View style={styles.chrome}>
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
            <SearchBar
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={t('pantryScreen.searchPlaceholder')}
              showSearchIcon={true}
              testID={pantryTestIDs.searchInput}
              innerRightIcon={settingsIcon}
            />
            {!!stats && (
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
            )}
            <View style={styles.tabs}>
              <FilterTabs<LocationFilter>
                tabs={tabsWithAddButton}
                activeTabId={locationFilter}
                onTabChange={handleLocationFilterChange}
                counts={locationCounts}
                testIDPrefix={pantryTestIDs.locationTabPrefix}
              />
            </View>
          </View>

          <View style={styles.listHost}>
            {/* An earlier sibling with no zIndex, so cells paint over it the
                instant they turn opaque. */}
            {overlayVisible ? (
              <PantryListSkeletonOverlay style={styles.overlayGutter} />
            ) : null}
            <RowReflowContext.Provider value={reflow.reflowing}>
              <FlashList<PantryListNode>
                renderScrollComponent={SwipeAwareScrollComponent}
                ref={flashListRef}
                CellRendererComponent={perfCallbacks.CellRendererComponent}
                testID={pantryTestIDs.list}
                data={listData}
                renderItem={renderItem}
                keyExtractor={pantryListKeyExtractor}
                drawDistance={DRAW_DISTANCE}
                maxItemsInRecyclePool={15}
                extraData={extraData}
                contentContainerStyle={listContentStyle}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                onScrollBeginDrag={reflow.onScrollBeginDrag}
                onScrollEndDrag={onScrollEndDrag}
                onMomentumScrollEnd={onMomentumScrollEnd}
                scrollEventThrottle={16}
                refreshControl={
                  onRefresh ? (
                    <ThemedRefreshControl
                      testID={pantryTestIDs.refreshControl}
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                    />
                  ) : undefined
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
                      failure={itemsFailure}
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
            </RowReflowContext.Provider>
          </View>

          <PantrySortModal
            visible={sortModalVisible}
            sortOption={sortOption}
            sortDirection={sortDirection}
            onSelect={handleSortSelect}
            onClose={closeSortModal}
          />
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
  chrome: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  header: {
    // The lead-in `Screen`'s `tab` chrome gives every other tab root.
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  tabs: {
    paddingBottom: theme.spacing.sm,
  },
  listHost: {
    flex: 1,
  },
  overlayGutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  listContent: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  listContentEmpty: {
    // The same gutter as the populated list: this container owns it, so zeroing
    // it here puts the empty state flush against the screen edge.
    paddingHorizontal: theme.layout.pageGutter,
    flexGrow: 1,
  },
}));
