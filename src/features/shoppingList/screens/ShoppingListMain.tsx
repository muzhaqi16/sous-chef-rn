import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabBar } from '#features/shoppingList/components/ShoppingListTabs/FilterTabBar';
import { ShoppingListErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { ShoppingListSkeleton } from '#components/base/Skeleton/ShoppingListSkeleton';
import { TabMainScreen } from '#components/templates/TabMainScreen';

import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useShoppingListScreen } from '#features/shoppingList/hooks/useShoppingListScreen';
import { ShoppingListModalsProvider } from '#features/shoppingList/context/ShoppingListModalsContext';
import { ShoppingListTutorialProvider } from '#features/shoppingList/context/ShoppingListTutorialContext';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';

import { ShoppingListMainContent } from './ShoppingListMainContent';

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after DeferredScreen gates rendering, so the skeleton paints instantly.
 */
const ShoppingListMainInner: React.FC = () => {
  const { navigate } = useAppNavigation();

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
        searchQuery={screenData.state.searchQuery}
        onSearchQueryClear={() => screenData.actions.setSearchQuery('')}
        onNavigateToListSettings={() => navigate('ListSettings')}
      >
        <ShoppingListMainContent screenData={screenData} />
      </ShoppingListModalsProvider>
    </ShoppingListTutorialProvider>
  );
};

const SKELETON_ROUTES = [
  { key: 'shopping', title: 'Shopping' },
  { key: 'purchased', title: 'Purchased' },
];

const SKELETON_NAV_STATE = { index: 0, routes: SKELETON_ROUTES };

const noop = () => {};

// Screen-level error boundary prevents full app reset on mutation failures
export const ShoppingListMain: React.FC = () => (
  <ShoppingListErrorBoundary>
    <DeferredScreen
      fallback={
        <TabMainScreen testID="shopping-list-screen">
          <TabScreenHeader label="Shopping list" title="Shopping List" />
          <View style={styles.searchBarContainer}>
            <SearchBar
              value=""
              onChangeText={noop}
              placeholder="Search shopping list..."
              showSearchIcon
              editable={false}
            />
          </View>
          <FilterTabBar
            navigationState={SKELETON_NAV_STATE}
            jumpTo={noop}
            counts={{ shopping: 0, purchased: 0 }}
          />
          <ShoppingListSkeleton />
        </TabMainScreen>
      }
      component={ShoppingListMainInner}
    />
  </ShoppingListErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.spacing['3'],
  },
}));
