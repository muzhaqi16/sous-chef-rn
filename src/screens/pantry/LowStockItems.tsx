import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '#utils/iconUtils';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { Header } from '#components/molecules/Header';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { SpotlightCoachMark } from '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAddItemToShoppingListMutation } from '#generated';
import { useCurrentPantry } from '#hooks/pantry/useCurrentPantry';
import { useAddLowStockToShoppingList } from '#hooks/pantry/useAddLowStockToShoppingList';
import {
  useTutorialSequence,
  type TutorialStep,
} from '#hooks/ui/useTutorialSequence';
import { commonStyles } from '#/styles/commonStyles';
import { createPropsComparator } from '#utils/memoUtils';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import {
  LowStockActionsProvider,
  useLowStockActions,
} from './LowStockActionsContext';

const keyExtractor = (item: { id: string }) => item.id;

type LayoutRect = { x: number; y: number; width: number; height: number };

// ── Tutorial steps ──

const LOW_STOCK_TUTORIAL_STEPS: TutorialStep[] = [
  {
    featureId: 'low_stock_tutorial_item_cart',
    title: 'Add to shopping list',
    subtitle: 'Tap to add this item to your shopping list',
    rectKey: 'itemCart',
  },
  {
    featureId: 'low_stock_tutorial_header_cart',
    title: 'Add all at once',
    subtitle: 'Add all low stock items to your shopping list at once',
    rectKey: 'headerCart',
  },
];

interface LowStockItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: { symbol: string } | null;
  isLowStock: boolean;
}

// --- Module-scope LowStockRenderItem ---

interface LowStockRenderItemProps {
  item: LowStockItem;
  primaryColor: string;
  onCartMeasure?: (rect: LayoutRect) => void;
}

const LowStockRenderItemComponent: React.FC<LowStockRenderItemProps> = ({
  item,
  primaryColor,
  onCartMeasure,
}) => {
  const { navigateTo, handleAddToList } = useLowStockActions();
  const cartRef = useRef<View>(null);

  const cartButton = (
    <Pressable
      onPress={() => handleAddToList(item.id)}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
    >
      <Icon name="cart-outline" size={20} color={primaryColor} />
    </Pressable>
  );

  return (
    <SwipeableItem onPress={() => navigateTo({ itemId: item.id })}>
      <View style={[commonStyles.card, styles.itemCard]}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.itemName}</Text>
          <Text style={[commonStyles.caption, styles.itemDetails]}>
            {item.quantity} {item.unit?.symbol} remaining
          </Text>
        </View>
        {onCartMeasure ? (
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

const arePropsEqual = createPropsComparator<LowStockRenderItemProps>({
  referenceKeys: ['primaryColor', 'onCartMeasure'],
  nestedComparisons: {
    item: ['id', 'itemName', 'quantity'],
    'item.unit': ['symbol'],
  },
});

const LowStockRenderItem = React.memo(
  LowStockRenderItemComponent,
  arePropsEqual,
);

const getLowStockItemType = () => 'item';

// --- Module-scope LowStockEmpty ---

interface LowStockEmptyProps {
  loading: boolean;
  hasItems: boolean;
}

const LowStockEmpty: React.FC<LowStockEmptyProps> = ({ loading, hasItems }) => {
  const { theme } = useUnistyles();

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
      <Icon name="cube-outline" size={64} color={theme.colors.success} />
      <Text style={[commonStyles.body, styles.emptyText]}>
        All items are above minimum stock levels
      </Text>
    </View>
  );
};

// --- Main component ---

export const LowStockItems: React.FC = () => {
  const { theme } = useUnistyles();

  const { goBack, navigateTo } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  // ── Focus tracking for tutorial pausing ──
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [onScreenFocus] = useState(() => () => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  });
  useFocusEffect(onScreenFocus);

  // Use cache-only hook for pantry resolution (no network requests)
  // This prevents query cascade when switching between pantry screens
  const { pantry, selectedHomeId } = useCurrentPantry();

  const { addLowStockToShoppingList, loading: addAllLoading } =
    useAddLowStockToShoppingList({ homeId: selectedHomeId ?? undefined });

  const {
    state: { items: allItems, loading, hasMore, isLoadingMore },
    actions: { refetch, loadMore },
  } = usePantryManagement(pantry?.id);
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  // Progressively load all pages so the isLowStock filter sees every item
  useEffect(() => {
    if (hasMore && !isLoadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loading, loadMore]);

  const lowStockItems = (() => {
    if (!allItems) return [];

    return allItems.filter(item => item.isLowStock);
  })();

  // ── Tutorial measurement state ──
  const [itemCartRect, setItemCartRect] = useState<LayoutRect | null>(null);
  const [headerCartRect, setHeaderCartRect] = useState<LayoutRect | null>(null);

  const tutorial = useTutorialSequence({
    steps: LOW_STOCK_TUTORIAL_STEPS,
    targetRects: {
      itemCart: itemCartRect,
      headerCart: headerCartRect,
    },
    canStart: lowStockItems.length > 0 && !loading,
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
      alertService.alert('Error', 'Failed to add to shopping list');
    }
  };

  const actions = {
    navigateTo: (params: { itemId: string }) =>
      navigateTo.pantryItemDetail(params),
    handleAddToList,
  };

  return (
    <View style={commonStyles.container}>
      <Header
        title="Low Stock Items"
        onBack={goBack}
        centerTitle
        rightActions={[
          {
            icon: 'cart-outline',
            onPress: addLowStockToShoppingList,
            loading: addAllLoading,
            testID: 'add-all-low-stock',
            onMeasure: setHeaderCartRect,
          },
        ]}
      />

      <LowStockActionsProvider actions={actions}>
        <FlashList
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          data={lowStockItems}
          keyExtractor={keyExtractor}
          {...FLASHLIST_DEFAULTS.fullScreen}
          getItemType={getLowStockItemType}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <LowStockEmpty loading={loading} hasItems={!!allItems} />
          }
          renderItem={({
            item,
            index,
          }: {
            item: LowStockItem;
            index: number;
          }) => (
            <LowStockRenderItem
              item={item}
              primaryColor={theme.colors.primary}
              onCartMeasure={index === 0 ? setItemCartRect : undefined}
            />
          )}
        />
      </LowStockActionsProvider>

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
    gap: theme.spacing.sm,
  },
  emptyState: {
    padding: theme.spacing['2xl'],
  },
  emptyText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
  },
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  itemCard: {
    ...commonStyles.rowSpaceBetween,
    marginBottom: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
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
