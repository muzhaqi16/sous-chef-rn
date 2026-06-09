import React, {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import {
  View,
  RefreshControl,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useApolloClient } from '@apollo/client/react';
import { Pressable } from '#components/atoms/themedComponents';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
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
import { PantryScreenSkeleton } from '#components/base/Skeleton/PantryScreenSkeleton';
import { TIMING } from '#constants/animations';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { preloadImages } from '#components/atoms/CachedImage';
import { resolveImageUrl } from '#utils/imageUtils';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

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

// Initial estimates for the collapsing chrome so the list's top padding is close
// on the first frame; refined once measured via onLayout (the chrome lives
// outside the list, so its layout isn't blocked by the cell paint).
const ESTIMATED_BANNER_HEIGHT = 196; // greeting + search + stats (collapses)
const ESTIMATED_TOOLBAR_HEIGHT = 60; // filter tabs (pinned)

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
    const { t } = useTranslation();
    const { bottom: safeBottom } = useSafeAreaInsets();
    // Apollo cache reads run inside the image-preload effect; each leaf
    // computes its own display data via `useFragment`.
    const client = useApolloClient();
    const flashListRef = useRef<FlashListRef<PantryListNode>>(null);
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
    // `showSkeletons` is computed below, after `windowedItems`, so it can also
    // bridge the useDeferredValue render lag (items present but not yet windowed).

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

    const localFilteredItems = items;
    const sortedItems = useServerSort
      ? localFilteredItems
      : sortItems(localFilteredItems);

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

    // Items exist but the deferred/windowed slice hasn't caught up to them yet —
    // a one-render `useDeferredValue` lag on the empty→populated transition (e.g.
    // a cache-cleared cold start where items arrive over the network: `items` is
    // already 18 while `deferredSortedItems` is still 0). Without this the list
    // flashes empty for that render; skeletons bridge it until the rows are
    // actually in the window. Transient by construction (the deferred value
    // always catches up on the next render), so it cannot stick.
    const renderLag = sortedItems.length > 0 && windowedItems.length === 0;
    const showSkeletons =
      awaitingItems || renderLag || (!hasShownContent && loading);

    // The FlashList holds only item rows now — header/search/stats/tabs render
    // as fixed chrome above it. Empty/loading states are handled by the footer
    // (PantryEmptyState) + the body overlay, not by blanking the data.
    const listData: PantryListNode[] = windowedItems;

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

    // ── Body skeleton overlay ──
    // PantryContent commits fast with the rows already in the list, but FlashList
    // then spends a while mounting/painting the cells on a cold JS thread. By then
    // the DeferredScreen fallback has faded, so the row area is blank with nothing
    // covering it. The chrome (header / stats / tabs) renders ABOVE the list, so
    // the FlashList holds only rows and this overlay can absolutely-fill its
    // container (`contentFill`) — the exact row area — with no layout measurement
    // (the measurement callback can't run during the JS-blocked paint anyway). It
    // lifts on FlashList's `onLoad` (first paint), one-shot per mount; the screen
    // stays mounted under the tab navigator, so there's no remount and we never
    // reset `listPainted` (sort/tab switches reuse already-painted cells).
    const [listPainted, setListPainted] = useState(false);

    const handleListLoad = (info: { elapsedTimeInMs: number }) => {
      perfCallbacks.onLoad(info);
      setListPainted(true);
    };

    // Show the overlay only when REAL rows are present and FlashList is still
    // painting them — not while the in-list skeleton (`showSkeletons`) is up
    // (data not ready / deferred lag), and not for search / no-home / empty
    // states. Keeps the two skeleton layers mutually exclusive.
    const hasRowsToPaint =
      items.length > 0 &&
      !searchQuery &&
      !noHomeSelected &&
      !noHomes &&
      !noPantries;
    const showLoadingOverlay = !listPainted && !showSkeletons && hasRowsToPaint;

    // ── Collapsing header ──
    // Chrome stays OUTSIDE the FlashList (so the list paints only rows and the
    // overlay/measurement stay clean). The "banner" (greeting + search + stats)
    // slides up off-screen as you scroll while the "toolbar" (filter tabs) pins
    // at the top. Both are absolutely positioned and share one transform —
    // translateY by up to the banner's height. The list (and overlay) get
    // `paddingTop = chromeHeight` so rows start below the chrome and reclaim the
    // banner's space once it's gone. The container clips (overflow: hidden) so
    // the banner can't bleed up into the status-bar inset.
    const headerScrollY = useSharedValue(0);
    const bannerHeightSV = useSharedValue(ESTIMATED_BANNER_HEIGHT);
    const searchActiveSV = useSharedValue(false);
    const [bannerHeight, setBannerHeight] = useState(ESTIMATED_BANNER_HEIGHT);
    const [toolbarHeight, setToolbarHeight] = useState(
      ESTIMATED_TOOLBAR_HEIGHT,
    );
    const chromeHeight = bannerHeight + toolbarHeight;

    // While searching, keep the header fully expanded so the search field (in the
    // banner) stays put and visible as results filter in.
    useEffect(() => {
      searchActiveSV.set(searchQuery.length > 0);
    }, [searchQuery, searchActiveSV]);

    const onBannerLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== bannerHeight) {
        setBannerHeight(h);
        bannerHeightSV.set(h);
      }
    };
    const onToolbarLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== toolbarHeight) setToolbarHeight(h);
    };

    // Track scroll offset for the collapse, then delegate to the prop handler
    // (tab-bar direction tracking) — FlashList takes a single onScroll.
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      headerScrollY.set(Math.max(0, e.nativeEvent.contentOffset.y));
      scrollHandler?.(e);
    };

    // Snap the banner fully open/closed when scrolling settles mid-collapse.
    const snapHeader = () => {
      const y = headerScrollY.get();
      const bh = bannerHeightSV.get();
      if (y > 0 && y < bh) {
        flashListRef.current?.scrollToOffset({
          offset: y < bh / 2 ? 0 : bh,
          animated: true,
        });
      }
    };
    const handleScrollEndDrag = (
      e: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
      // Snap now only when no momentum follows; otherwise momentum-end handles it.
      if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.5) snapHeader();
      onScrollEndDrag?.(e);
    };
    const handleMomentumEnd = () => {
      snapHeader();
      onMomentumScrollEnd?.();
    };

    const collapseStyle = useAnimatedStyle(() => {
      const translateY = searchActiveSV.get()
        ? 0
        : -Math.min(headerScrollY.get(), bannerHeightSV.get());
      return { transform: [{ translateY }] };
    });

    // DEV: window/perf tracking — confirms FlashList is handed a bounded window
    // (not the whole load-all page) and surfaces how sort/filter sizes the set.
    useEffect(() => {
      if (__DEV__) {
        console.log(
          `📊 [PantryWindow] loaded=${items.length} sorted=${deferredSortedItems.length} rendered=${windowedItems.length} window=${clientWindow} serverHasMore=${hasMore} clientHasMore=${clientHasMore}`,
        );
      }
    }, [
      items.length,
      deferredSortedItems.length,
      windowedItems.length,
      clientWindow,
      hasMore,
      clientHasMore,
    ]);

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

    // Render the footer "empty area" whenever there are no rows. PantryEmptyState
    // shows skeleton placeholders while `showSkeletons` is true, otherwise the
    // contextual empty / no-results state. (Previously this was gated on
    // `!showSkeletons`, which made PantryEmptyState's skeleton branch unreachable
    // and left a blank body — just the sticky tabs — during loading.)
    // Based on what's actually RENDERED (the window), not the full sorted set, so
    // the deferred-render lag (sortedItems > 0 but windowedItems still 0) routes
    // to PantryEmptyState's skeleton branch instead of the empty/PaginationFooter.
    const isEmpty = windowedItems.length === 0;

    const listContentStyle = isEmpty
      ? styles.listContentEmpty
      : {
          paddingHorizontal: 0,
          paddingBottom: getTabBarBottomPadding(safeBottom),
        };

    const listKeyExtractor = (item: PantryListNode) => item.id;

    return (
      <PantryActionsProvider actions={itemActions}>
        <View style={styles.container}>
          <View style={styles.listContainer}>
            <View style={styles.contentFill}>
              <FlashList<PantryListNode>
                ref={flashListRef}
                CellRendererComponent={AnimatedCellRenderer}
                testID="pantry-list"
                data={listData}
                renderItem={renderItem}
                keyExtractor={listKeyExtractor}
                drawDistance={DRAW_DISTANCE}
                maxItemsInRecyclePool={15}
                extraData={extraData}
                contentContainerStyle={[
                  listContentStyle,
                  { paddingTop: chromeHeight },
                ]}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollEnd={handleMomentumEnd}
                scrollEventThrottle={16}
                refreshControl={
                  onRefresh ? (
                    <RefreshControl
                      testID="pantry-refresh-control"
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      progressViewOffset={chromeHeight}
                    />
                  ) : undefined
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
                      itemCount={windowedItems.length}
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
                onLoad={handleListLoad}
                onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
                maintainVisibleContentPosition={MVCP_DISABLED}
              />
              {/* Loading overlay — fills the list; `paddingTop` aligns the
                  skeleton rows with the real rows (below the chrome), and the
                  absolutely-positioned chrome occludes its top edge so it reads
                  as body-only. Lifts on `onLoad`, then crossfades out. */}
              {showLoadingOverlay ? (
                <Animated.View
                  exiting={FadeOut.duration(TIMING.STANDARD)}
                  style={[styles.bodyOverlay, { paddingTop: chromeHeight }]}
                  pointerEvents="none"
                >
                  <PantryScreenSkeleton />
                </Animated.View>
              ) : null}
            </View>
          </View>

          {/* Pinned toolbar (tabs only) — slides up with the banner until the
              banner is fully collapsed, then stays pinned at the top so the
              filter tabs are always reachable. */}
          <Animated.View
            onLayout={onToolbarLayout}
            style={[styles.toolbar, { top: bannerHeight }, collapseStyle]}
          >
            <View style={styles.tabsBar}>
              <FilterTabs<LocationFilter>
                tabs={tabsWithAddButton}
                activeTabId={locationFilter}
                onTabChange={onLocationFilterChange}
                counts={locationCounts}
                testIDPrefix="pantry-location-tab"
              />
            </View>
          </Animated.View>

          {/* Collapsible banner (greeting + search + stats, in that order) —
              slides up off-screen as you scroll, reclaiming its space for rows.
              Forced back open while a search query is active so the field stays
              editable. */}
          <Animated.View
            onLayout={onBannerLayout}
            style={[styles.banner, collapseStyle]}
          >
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
                  sortLabel={`${t('pantryScreen.sort')} ${
                    sortDirection === PantrySortDirection.ASC ? '↑' : '↓'
                  }`}
                  onSortPress={openSortModal}
                />
              </View>
            )}
          </Animated.View>

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
    // Clip the collapsing banner as it translates up so it doesn't bleed
    // over the top safe-area inset applied by the screen layout.
    overflow: 'hidden',
  },
  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  tabsBar: {
    backgroundColor: theme.colors.background,
    paddingBottom: theme.spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
  statsContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
  // Collapsing banner (greeting + stats) — absolutely pinned to the top; slides
  // up via the shared `collapseStyle` transform as the list scrolls.
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: theme.zIndex.sticky,
    backgroundColor: theme.colors.background,
  },
  // Pinned toolbar (search + tabs) — `top` is set inline to the banner height;
  // it shares the same transform so it slides up with the banner, then stays at
  // the top once the banner is fully collapsed.
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: theme.zIndex.sticky,
    backgroundColor: theme.colors.background,
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
  // Loading overlay: absolutely fills the list container (which holds only rows
  // now — chrome is above it) and fully occludes the in-progress FlashList paint
  // until `onLoad` fires.
  bodyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
}));
