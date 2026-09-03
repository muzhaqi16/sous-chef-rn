import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';
// RNGH's Pressable for the cart button: nested in the row's RNGH Swipeable, its
// native button captures the tap so the row's onPress does not also fire.
import { Pressable } from 'react-native-gesture-handler';
import type { StaticScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { StyleSheet } from 'react-native-unistyles';
import { differenceInCalendarDays } from 'date-fns';

import { Icon } from '#utils/iconUtils';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { Header } from '#components/molecules/Header';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
import { PantryItemSkeleton } from '#features/pantry/components/skeletons/PantryItemSkeleton';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryItemFilters } from '#/graphql/generated/schemaTypes';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useAddLowStockToShoppingList } from '#features/pantry/hooks/useAddLowStockToShoppingList';
import { useSelectedShoppingListId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useAddPantryItemToShoppingList } from '#features/pantry/hooks/useAddPantryItemToShoppingList';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { commonStyles } from '#/styles/commonStyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import {
  FilteredItemsActionsProvider,
  useFilteredItemsActions,
} from './FilteredItemsActionsContext';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';
import type { Translate } from '#/i18n/types';

export type FilteredPantryItemsMode = 'lowStock' | 'expiring' | 'expired';

type FilteredPantryItemsParams = {
  mode?: FilteredPantryItemsMode;
};

// Structurally compatible with the `GetPantry` node, so `usePantryManagement`
// items flow through without casts.
interface FilteredItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: { id: string; symbol: string } | null;
  isLowStock: boolean;
  expiresAt: string | null;
}

interface ModeConfig {
  title: string;
  emptyMessage: string;
  emptyIcon: string;
  /**
   * Non-nullable on purpose. `itemsConnection` caps cached edges at
   * `MAX_WINDOW_EDGES` (100) while `hasNextPage` reports the last FETCHED page,
   * so above 100 items a client-only filter silently reports "none". A non-null
   * value also re-keys the cache entry (`keyArgs: ['filters', …]`).
   */
  serverFilters: PantryItemFilters;
  filter: (item: FilteredItem) => boolean;
  sort?: (a: FilteredItem, b: FilteredItem) => number;
  subtitle: (item: FilteredItem) => string;
  tutorialSteps: TutorialStep[];
  showCartAction: boolean;
}

function formatExpirySubtitle(
  expiresAt: string | null | undefined,
  t: Translate,
): string {
  if (!expiresAt) return '';
  const days = differenceInCalendarDays(new Date(expiresAt), new Date());
  if (days < 0) return t('filteredPantry.expired');
  if (days === 0) return t('labels.expiresToday');
  if (days === 1) return t('filteredPantry.expiresTomorrow');
  return t('filteredPantry.expiresInDays', { count: days });
}

function buildModeConfig(
  t: Translate,
): Record<FilteredPantryItemsMode, ModeConfig> {
  return {
    lowStock: {
      title: t('filteredPantry.lowStockTitle'),
      emptyMessage: t('filteredPantry.lowStockEmpty'),
      emptyIcon: 'cube-outline',
      // `lowStock` is what `PantryStats.lowStockCount` counts and
      // `PantryItem.isLowStock` reports, so badge and list cannot disagree. NOT
      // the `lowStockAlert` opt-in, which is only a notification preference.
      serverFilters: { lowStock: true },
      filter: item => item.isLowStock,
      subtitle: item =>
        t('filteredPantry.remaining', {
          quantity: item.quantity,
          unit: item.unit?.symbol ?? '',
        }).trim(),
      tutorialSteps: [
        {
          featureId: 'low_stock_tutorial_item_cart',
          title: t('filteredPantry.tutorialAddTitle'),
          subtitle: t('filteredPantry.tutorialAddSubtitle'),
          rectKey: 'itemCart',
        },
        {
          featureId: 'low_stock_tutorial_header_cart',
          title: t('filteredPantry.tutorialAddAllTitle'),
          subtitle: t('filteredPantry.tutorialAddAllSubtitle'),
          rectKey: 'headerCart',
        },
      ],
      showCartAction: true,
    },
    expiring: {
      title: t('filteredPantry.expiringTitle'),
      emptyMessage: t('filteredPantry.expiringEmpty'),
      emptyIcon: 'time-outline',
      // `expiringSoon` has NO lower bound, so it returns already-expired items
      // too — the superset this mode and `expired` split between them.
      // `expirationDays` is deliberately not passed: `PantryStats.expiringCount`
      // is always a 7-day window, so widening it here would list items the badge
      // never counted.
      serverFilters: { expiringSoon: true },
      // Mirrors `PantryStats.expiringCount`: within 7 days, not yet expired.
      filter: item => {
        if (!item.expiresAt || item.quantity <= 0) return false;
        const days = differenceInCalendarDays(
          new Date(item.expiresAt),
          new Date(),
        );
        return days >= 0 && days <= 7;
      },
      sort: (a, b) => {
        const aDate = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bDate = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aDate - bDate;
      },
      subtitle: item => formatExpirySubtitle(item.expiresAt, t),
      tutorialSteps: [],
      showCartAction: false,
    },
    expired: {
      title: t('filteredPantry.expiredTitle'),
      emptyMessage: t('filteredPantry.expiredEmpty'),
      emptyIcon: 'alert-circle-outline',
      // Same unbounded superset as `expiring`; the predicate keeps the past-dated.
      serverFilters: { expiringSoon: true },
      // Mirrors server `PantryStats.expiredCount`: past expiresAt, quantity > 0.
      filter: item => {
        if (!item.expiresAt || item.quantity <= 0) return false;
        const days = differenceInCalendarDays(
          new Date(item.expiresAt),
          new Date(),
        );
        return days < 0;
      },
      sort: (a, b) => {
        // Oldest-expired first.
        const aDate = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bDate = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aDate - bDate;
      },
      subtitle: item => formatExpirySubtitle(item.expiresAt, t),
      tutorialSteps: [],
      showCartAction: false,
    },
  };
}

const keyExtractor = (item: { id: string }) => item.id;
const getItemType = () => 'item';

type LayoutRect = { x: number; y: number; width: number; height: number };

interface FilteredRenderItemProps {
  item: FilteredItem;
  subtitleFn: (item: FilteredItem) => string;
  showCart: boolean;
  onCartMeasure?: (rect: LayoutRect) => void;
}

const FilteredRenderItemComponent: React.FC<FilteredRenderItemProps> = ({
  item,
  subtitleFn,
  showCart,
  onCartMeasure,
}) => {
  const { navigateTo, handleAddToList } = useFilteredItemsActions();
  const cartRef = useRef<View>(null);

  const cartButton =
    showCart && handleAddToList ? (
      <Pressable
        onPress={() =>
          handleAddToList(item.id, {
            itemName: item.itemName,
            unitId: item.unit?.id,
          })
        }
        style={styles.actionButton}
      >
        <Icon name="cart-outline" size={20} tone="primary" />
      </Pressable>
    ) : null;

  return (
    <SwipeableItem onPress={() => navigateTo({ itemId: item.id })}>
      <View style={[commonStyles.card, commonStyles.rowSpaceBetween]}>
        <View style={styles.itemInfo}>
          <Text size="base" weight="medium">
            {item.itemName}
          </Text>
          <Text style={[commonStyles.caption, styles.itemDetails]}>
            {subtitleFn(item)}
          </Text>
        </View>
        {cartButton && onCartMeasure ? (
          <View
            ref={cartRef}
            collapsable={false}
            onLayout={() => {
              requestAnimationFrame(() => {
                cartRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
                  if (w > 0 && h > 0) {
                    onCartMeasure({ x: pageX, y: pageY, width: w, height: h });
                  }
                });
              });
            }}
          >
            {cartButton}
          </View>
        ) : (
          cartButton
        )}
      </View>
    </SwipeableItem>
  );
};

const FilteredRenderItem = FilteredRenderItemComponent;

interface FilteredEmptyProps {
  state: DataState;
  onRetry: () => void;
  icon: string;
  message: string;
}

/**
 * Error and offline get their own branch because the empty message is
 * congratulatory ("You're all stocked up") — good news the app has no evidence
 * for if the fetch failed; skeletons cannot stand in for a failure either.
 */
const FilteredEmpty: React.FC<FilteredEmptyProps> = ({
  state,
  onRetry,
  icon,
  message,
}) => {
  if (state === 'loading') {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map(key => (
          <PantryItemSkeleton key={key} />
        ))}
      </View>
    );
  }

  if (state === 'error' || state === 'offline') {
    return <DataStateView state={state} onRetry={onRetry} />;
  }

  return (
    <View style={[commonStyles.center, styles.emptyState]}>
      <Icon name={icon} size={64} tone="success" />
      <Text align="center" style={[commonStyles.body, styles.emptyText]}>
        {message}
      </Text>
    </View>
  );
};

export const FilteredPantryItems: React.FC<
  StaticScreenProps<FilteredPantryItemsParams | undefined>
> = ({ route }) => {
  const { t } = useTranslation();
  const mode = route.params?.mode ?? 'lowStock';
  const config = buildModeConfig(t)[mode];

  const { goBack, toPantryItemDetail } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [onScreenFocus] = useState(() => () => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  });
  useFocusEffect(onScreenFocus);

  // Use cache-only hook for pantry resolution (no network requests)
  const { pantry, selectedHomeId } = useCurrentPantry();

  const { addLowStockToShoppingList, loading: addAllLoading } =
    useAddLowStockToShoppingList({ homeId: selectedHomeId ?? undefined });

  const permissions = usePantryPermissions();
  const selectedShoppingListId = useSelectedShoppingListId();
  const { addToList } = useAddPantryItemToShoppingList(selectedShoppingListId);

  const {
    state: {
      items: allItems,
      loading,
      error,
      hasResult,
      skipped,
      hasMore,
      isLoadingMore,
    },
    actions: { refetch, loadMore },
  } = usePantryManagement(pantry?.id, {
    filters: config.serverFilters,
  });

  // Classified on the FETCHED set: a client filter narrowing to nothing is the
  // genuine empty case, a fetch that never returned is not.
  const dataState = useDataState({
    loading,
    error,
    hasResult,
    skipped,
    isEmpty: !allItems?.length,
  });

  // Progressively load all pages so the filter sees every item
  useEffect(() => {
    if (hasMore && !isLoadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loading, loadMore]);

  const filteredItems = (() => {
    if (!allItems) return [];
    const filtered = allItems.filter(config.filter);
    if (config.sort) {
      return filtered.sort(config.sort);
    }
    return filtered;
  })();

  // Full screen, so the per-cell wrapper's cost is worth the blank-cell
  // instrumentation (per-session sampled, 5% in release).
  const flashListRef = useRef<FlashListRef<FilteredItem>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'FilteredPantryItems',
    hasRealContent: filteredItems.length > 0,
  });
  useDataReferenceTracker(
    filteredItems,
    'FilteredPantryItems.items',
    perfCallbacks.onDataReferenceChange,
  );

  const [itemCartRect, setItemCartRect] = useState<LayoutRect | null>(null);
  const [headerCartRect, setHeaderCartRect] = useState<LayoutRect | null>(null);

  const tutorial = useTutorialSequence({
    steps: config.tutorialSteps,
    targetRects: {
      itemCart: itemCartRect,
      headerCart: headerCartRect,
    },
    canStart: filteredItems.length > 0 && !loading,
    isPaused: !isScreenFocused,
  });

  const handleRefresh = () => {
    executeRefreshWithFinally(refetch, setRefreshing);
  };

  const handleAddToList = async (
    itemId: string,
    display: { itemName: string; unitId?: string },
  ) => {
    if (!selectedShoppingListId) {
      toastService.info(t('filteredPantry.noListSelected'));
      return;
    }
    if ((await addToList(itemId, display)) === 'reverted') {
      alertService.alert(
        t('labels.error'),
        t('filteredPantry.addToShoppingFailed'),
      );
    }
  };

  const showCart = config.showCartAction && permissions.canAddItems;

  const actions = {
    navigateTo: (params: { itemId: string }) => toPantryItemDetail(params),
    ...(showCart && { handleAddToList }),
  };

  const headerRightActions: HeaderAction[] | undefined = showCart
    ? [
        {
          icon: 'cart-outline',
          onPress: addLowStockToShoppingList,
          loading: addAllLoading,
          testID: 'add-all-low-stock',
          onMeasure: setHeaderCartRect,
        },
      ]
    : undefined;

  return (
    <View style={commonStyles.container}>
      <Header
        title={config.title}
        onBack={goBack}
        centerTitle
        rightActions={headerRightActions}
      />

      <FilteredItemsActionsProvider actions={actions}>
        <FlashList
          ref={flashListRef}
          CellRendererComponent={perfCallbacks.CellRendererComponent}
          onLoad={perfCallbacks.onLoad}
          onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
          onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
          renderScrollComponent={SwipeAwareScrollComponent}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          data={filteredItems}
          keyExtractor={keyExtractor}
          {...FLASHLIST_DEFAULTS.fullScreen}
          getItemType={getItemType}
          refreshControl={
            <ThemedRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={
            <FilteredEmpty
              state={dataState}
              onRetry={handleRefresh}
              icon={config.emptyIcon}
              message={config.emptyMessage}
            />
          }
          renderItem={({
            item,
            index,
          }: {
            item: FilteredItem;
            index: number;
          }) => (
            <FilteredRenderItem
              item={item}
              subtitleFn={config.subtitle}
              showCart={showCart}
              onCartMeasure={index === 0 ? setItemCartRect : undefined}
            />
          )}
        />
      </FilteredItemsActionsProvider>

      {tutorial.currentStep ? (
        <SpotlightCoachMark
          targetRect={tutorial.currentStep.targetRect}
          title={tutorial.currentStep.title}
          subtitle={tutorial.currentStep.subtitle}
          stepIndex={tutorial.currentStep.stepIndex}
          totalSteps={tutorial.currentStep.totalSteps}
          onDismiss={tutorial.skipAll}
          onTargetPress={tutorial.advance}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  emptyState: {
    padding: theme.spacing['2xl'],
  },
  emptyText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
  },
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemDetails: {
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
