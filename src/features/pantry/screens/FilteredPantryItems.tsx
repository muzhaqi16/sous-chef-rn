import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import type { StaticScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { differenceInCalendarDays } from 'date-fns';

import { Icon } from '#utils/iconUtils';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { Header, type HeaderAction } from '#components/molecules/Header';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMutation } from '@apollo/client/react';
import { AddItemToShoppingListFromFilteredPantryDocument } from './FilteredPantryItems.generated';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useAddLowStockToShoppingList } from '#features/pantry/hooks/useAddLowStockToShoppingList';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { commonStyles } from '#/styles/commonStyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import {
  FilteredItemsActionsProvider,
  useFilteredItemsActions,
} from './FilteredItemsActionsContext';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';

// ── Types ──

export type FilteredPantryItemsMode = 'lowStock' | 'expiring';

type FilteredPantryItemsParams = {
  mode?: FilteredPantryItemsMode;
};

// Minimal shape needed by `FilteredPantryItems` — kept structurally
// compatible with the `GetPantry` node so the `usePantryManagement` items
// flow through without explicit casts.
interface FilteredItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: { id: string; symbol: string } | null;
  isLowStock: boolean;
  expiresAt: string | null;
}

// ── Mode config ──

interface ModeConfig {
  title: string;
  emptyMessage: string;
  emptyIcon: string;
  filter: (item: FilteredItem) => boolean;
  sort?: (a: FilteredItem, b: FilteredItem) => number;
  subtitle: (item: FilteredItem) => string;
  tutorialSteps: TutorialStep[];
  showCartAction: boolean;
}

type TFn = ReturnType<typeof useTranslation>['t'];

function formatExpirySubtitle(
  expiresAt: string | null | undefined,
  t: TFn,
): string {
  if (!expiresAt) return '';
  const days = differenceInCalendarDays(new Date(expiresAt), new Date());
  if (days < 0) return t('filteredPantry.expired');
  if (days === 0) return t('filteredPantry.expiresToday');
  if (days === 1) return t('filteredPantry.expiresTomorrow');
  return t('filteredPantry.expiresInDays', { count: days });
}

function buildModeConfig(t: TFn): Record<FilteredPantryItemsMode, ModeConfig> {
  return {
    lowStock: {
      title: t('filteredPantry.lowStockTitle'),
      emptyMessage: t('filteredPantry.lowStockEmpty'),
      emptyIcon: 'cube-outline',
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
      filter: item => {
        if (!item.expiresAt) return false;
        const days = differenceInCalendarDays(
          new Date(item.expiresAt),
          new Date(),
        );
        return days <= 7;
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
  };
}

// ── Helpers ──

const keyExtractor = (item: { id: string }) => item.id;
const getItemType = () => 'item';

type LayoutRect = { x: number; y: number; width: number; height: number };

// ── Render item ──

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
        onPress={() => handleAddToList(item.id)}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.pressed,
        ]}
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

// ── Empty state ──

interface FilteredEmptyProps {
  loading: boolean;
  hasItems: boolean;
  icon: string;
  message: string;
}

const FilteredEmpty: React.FC<FilteredEmptyProps> = ({
  loading,
  hasItems,
  icon,
  message,
}) => {
  if (loading || !hasItems) {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map(key => (
          <PantryItemSkeleton key={key} />
        ))}
      </View>
    );
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

// ── Main component ──

export const FilteredPantryItems: React.FC<
  StaticScreenProps<FilteredPantryItemsParams | undefined>
> = ({ route }) => {
  const { t } = useTranslation();
  const mode = route.params?.mode ?? 'lowStock';
  const config = buildModeConfig(t)[mode];

  const { goBack, toPantryItemDetail } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  // ── Focus tracking for tutorial pausing ──
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

  const {
    state: { items: allItems, loading, hasMore, isLoadingMore },
    actions: { refetch, loadMore },
  } = usePantryManagement(pantry?.id);
  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromFilteredPantryDocument,
  );

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

  // ── Tutorial measurement state ──
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddToList = async (itemId: string) => {
    try {
      await addToShoppingList({
        variables: { input: { shoppingListId: '', itemId } },
      });
    } catch {
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
              loading={loading}
              hasItems={!!allItems}
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
