import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabBar } from '#features/shoppingList/components/ShoppingListTabs/FilterTabBar';
import { ShoppingListErrorBoundary } from '#components/providers/ScreenErrorBoundary';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { ShoppingListSkeleton } from '#features/shoppingList/components/skeletons/ShoppingListSkeleton';

import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useStore } from '#store';
import { useShoppingListScreen } from '#features/shoppingList/hooks/useShoppingListScreen';
import { ShoppingListModalsProvider } from '#features/shoppingList/context/ShoppingListModalsContext';
import { ShoppingListTutorialProvider } from '#features/shoppingList/context/ShoppingListTutorialContext';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';

import { ShoppingListMainContent } from '#features/shoppingList/components/ShoppingListMainContent';
import { Screen } from '#components/templates/Screen';

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after DeferredScreen gates rendering, so the skeleton paints instantly.
 */
const ShoppingListMainInner: React.FC = () => {
  const { toListSettings } = useAppNavigation();

  // Deep link `shopping/:listId` selects that list; the selection store drives
  // which list `useShoppingListScreen` resolves. RN's global param-list
  // registration types tab-route params as `object`, so read the segment off
  // the route directly.
  const route = useRoute();
  const deepLinkedListId = (route.params as { listId?: string } | undefined)
    ?.listId;
  useEffect(() => {
    if (deepLinkedListId) {
      useStore.getState().setSelectedShoppingListId(deepLinkedListId);
    }
  }, [deepLinkedListId]);

  // --- Screen Data Hook ---
  const screenData = useShoppingListScreen();

  // --- Lifecycle: optimistic restoration, cache persistence, perf tracking ---
  useTabScreenLifecycle({
    screenName: 'ShoppingListMain',
    optimisticTypes: ['ShoppingList', 'ShoppingListItem'],
    telemetryProperties: () => ({
      list_id: screenData.state.currentListId,
      item_count:
        (screenData.state.totalCountUnpurchased ?? 0) +
        (screenData.state.totalCountPurchased ?? 0),
      purchased_count: screenData.state.totalCountPurchased ?? 0,
      has_lists: screenData.state.lists.length > 0,
    }),
  });

  return (
    <ShoppingListTutorialProvider canStart={screenData.state.lists.length > 0}>
      <ShoppingListModalsProvider
        currentListId={screenData.state.currentListId}
        items={[
          ...(screenData.state.rawUnpurchasedItems ?? []),
          ...(screenData.state.rawPurchasedItems ?? []),
        ]}
        recordPurchase={screenData.actions.recordPurchase}
        searchQuery={screenData.state.searchQuery}
        onSearchQueryClear={() => screenData.actions.setSearchQuery('')}
        onNavigateToListSettings={() => toListSettings()}
      >
        <ShoppingListMainContent screenData={screenData} />
      </ShoppingListModalsProvider>
    </ShoppingListTutorialProvider>
  );
};

const noop = () => {};

const ShoppingListMainFallback: React.FC = () => {
  const { t } = useTranslation();
  const skeletonRoutes = [
    { key: 'shopping', title: t('shoppingListScreen.tabShopping') },
    { key: 'purchased', title: t('shoppingListScreen.tabPurchased') },
  ];
  return (
    <Screen
      testID="shopping-list-screen"
      header={{
        variant: 'tab',
        label: t('shoppingListScreen.label'),
        title: t('labels.shoppingList'),
      }}
      scroll="list"
      gutter="none"
    >
      <View style={styles.searchBarContainer}>
        <SearchBar
          value=""
          onChangeText={noop}
          placeholder={t('shoppingListScreen.searchPlaceholder')}
          showSearchIcon
          editable={false}
        />
      </View>
      <FilterTabBar
        navigationState={{ index: 0, routes: skeletonRoutes }}
        jumpTo={noop}
        counts={{ shopping: 0, purchased: 0 }}
      />
      <ShoppingListSkeleton />
    </Screen>
  );
};

// Screen-level error boundary prevents full app reset on mutation failures
export const ShoppingListMain: React.FC = () => (
  <ShoppingListErrorBoundary>
    <DeferredScreen
      fallback={<ShoppingListMainFallback />}
      component={ShoppingListMainInner}
    />
  </ShoppingListErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.spacing.base,
  },
}));
