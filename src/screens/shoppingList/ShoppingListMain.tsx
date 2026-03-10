import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useFocusEffect } from '@react-navigation/native';

import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabBar } from '#components/organisms/ShoppingListTabs/FilterTabBar';
import { ShoppingListErrorBoundary } from '#/components/providers/ScreenErrorBoundary';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { ShoppingListSkeleton } from '#components/base/Skeleton/ShoppingListSkeleton';

import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useShoppingListScreen } from '#hooks/shoppingList/useShoppingListScreen';
import { ShoppingListModalsProvider } from '#/context/ShoppingListModalsContext';
import { useOptimisticDataRestorationMultiple } from '#/hooks/offline/useOptimisticDataRestoration';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';

import { ShoppingListMainContent } from './ShoppingListMainContent';

// Module-scope focus callback — pauses cache persistence on blur, resumes on focus.
// Defined outside component body so the reference is stable (no useCallback needed).
const onScreenFocus = () => {
  apolloCachePersistence.resume();
  return () => {
    apolloCachePersistence.pause();
  };
};

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after DeferredScreen gates rendering, so the skeleton paints instantly.
 */
const ShoppingListMainInner: React.FC = () => {
  // Restore optimistic data on mount (offline changes that haven't synced)
  // Hook handles array stability internally - inline array is fine
  useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);

  // PERF: Pause cache persistence on blur so heavy serialization doesn't
  // fire during the next screen's scroll. Resume on focus to flush pending saves.
  useFocusEffect(onScreenFocus);

  const { navigate } = useAppNavigation();

  // --- Screen Data Hook ---
  const screenData = useShoppingListScreen();

  return (
    <ShoppingListModalsProvider
      currentListId={screenData.currentListId}
      items={[...screenData.rawUnpurchasedItems, ...screenData.rawPurchasedItems]}
      searchQuery={screenData.searchQuery}
      onSearchQueryClear={() => screenData.setSearchQuery('')}
      onNavigateToListSettings={() => navigate('ListSettings')}
    >
      <ShoppingListMainContent screenData={screenData} />
    </ShoppingListModalsProvider>
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
        <View style={styles.container} testID="shopping-list-screen">
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
        </View>
      }
      component={ShoppingListMainInner}
    />
  </ShoppingListErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md,
  },
}));
