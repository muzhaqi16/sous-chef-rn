import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { SearchBar } from '#components/molecules/SearchBar';
import { DataStateView } from '#components/organisms/DataStateView';
import { Loading } from '#components/molecules/Loading';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { useDataState } from '#hooks/data/useDataState';
import { useDeleteRecipe } from '#features/recipes/hooks/useDeleteRecipe';
import { MyRecipeCard } from '#features/recipes/components/MyRecipeCard';
import { useRecipeManagement, type MyRecipeNode } from './useRecipeManagement';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { useLocalSearch } from '#hooks/search/useLocalSearch';
import { SubScreen } from '#components/templates/SubScreen';
import { useScreenListInset } from '#components/templates/useScreenListInset';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { SearchIncompleteNotice } from '#features/recipes/components/SearchIncompleteNotice';

const keyExtractor = (item: MyRecipeNode) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

export const MyRecipes: React.FC = () => {
  useScreenTransition('MyRecipes');
  const { t } = useTranslation();
  const { toRecipeDetail, toRecipeEdit, toRecipeCreate } = useAppNavigation();
  const listInset = useScreenListInset();
  const [searchQuery, setSearchQuery] = useState('');

  // Search filters on the device, so a query needs every page.
  const searchTerm = searchQuery.trim();
  const {
    state: {
      recipes: myRecipes,
      loading,
      error,
      hasResult,
      skipped,
      hasMore,
      isLoadingMore,
      isLoadingRemainingPages,
      isSearchIncomplete,
    },
    actions: { refetch, loadMore, retryRemainingPages },
  } = useRecipeManagement({
    loadAllPages: searchTerm.length > 0,
    filterKey: searchTerm,
  });

  // Filtered here, never in the cell: a cell returning null keeps its layout
  // slot and fragment subscription. `name`/`description` are selected on the
  // query's node for this (recipe.graphql).
  const filteredRecipes = useLocalSearch(myRecipes, searchQuery, [
    r => r.name,
    r => r.description,
  ]);

  // Instrumented like PantryContent/SortableList so this list reports
  // `flashlist_initial_load_ms` and blank-cell episodes instead of being
  // invisible to every metric we have.
  const flashListRef = useRef<FlashListRef<MyRecipeNode>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'MyRecipes',
    hasRealContent: filteredRecipes.length > 0,
    rowCount: filteredRecipes.length,
  });
  useDataReferenceTracker(
    filteredRecipes,
    'MyRecipes.items',
    perfCallbacks.onDataReferenceChange,
  );

  const dataState = useDataState({
    loading,
    error,
    hasResult,
    skipped,
    isEmpty: myRecipes.length === 0,
  });

  // A search matching nothing is not an empty library: `isEmpty` reads the
  // UNFILTERED list, so this branch keeps a non-matching query off both a blank
  // list and "create your first recipe".
  const emptyProps = isSearchIncomplete
    ? {
        icon: 'warning-outline',
        title: t('recipes.searchIncompleteTitle'),
        description: t('recipes.searchIncompleteDescription'),
        action: { label: t('labels.retry'), onPress: retryRemainingPages },
      }
    : myRecipes.length > 0
    ? {
        icon: 'search-outline',
        title: t('empty.noResultsFor', { query: searchTerm }),
      }
    : {
        icon: 'create-outline',
        title: t('recipes.myRecipesEmptyTitle'),
        description: t('recipes.myRecipesEmptyDescription'),
        action: {
          label: t('recipes.createRecipe'),
          onPress: () => toRecipeCreate(),
        },
      };

  const { deleteRecipe } = useDeleteRecipe();

  const handleItemPress = (id: string) => {
    toRecipeDetail({ recipeId: id });
  };

  const handleEditRecipe = (id: string) => {
    toRecipeEdit({ recipeId: id });
  };

  const handleDeleteRecipe = async (id: string) => {
    // A refusal has been reported and the recipe still exists server-side, so
    // a refetch restores the list. A queued removal stands and replays later.
    const deleted = await deleteRecipe(id);
    if (!deleted) await refetch();
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () =>
    executeRefreshWithFinally(() => refetch(), setRefreshing);

  const handleEndReached = () => {
    if (hasMore) {
      void loadMore();
    }
  };

  const renderItem = ({ item }: { item: MyRecipeNode }) => (
    <MyRecipeCard
      recipeRef={item}
      onPress={handleItemPress}
      onEdit={handleEditRecipe}
      onDelete={handleDeleteRecipe}
    />
  );

  return (
    <SubScreen
      testID={recipesTestIDs.myRecipesScreen}
      title={t('recipes.myRecipesTitle')}
      scroll="list"
      gutter="none"
    >
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('recipes.myRecipesSearchPlaceholder')}
          showSearchIcon
        />
      </View>
      {dataState === 'ready' &&
      filteredRecipes.length === 0 &&
      isLoadingRemainingPages ? (
        <Loading size="small" message={t('recipes.myRecipesSearchingAll')} />
      ) : dataState !== 'ready' || filteredRecipes.length === 0 ? (
        <DataStateView
          state={dataState === 'ready' ? 'empty' : dataState}
          onRetry={handleRefresh}
          empty={emptyProps}
        />
      ) : (
        <FlashList
          ref={flashListRef}
          CellRendererComponent={perfCallbacks.CellRendererComponent}
          onLoad={perfCallbacks.onLoad}
          onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
          onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
          data={filteredRecipes}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          renderItem={renderItem}
          refreshControl={
            <PlainScrollRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          onEndReached={handleEndReached}
          ListHeaderComponent={
            isSearchIncomplete ? (
              <SearchIncompleteNotice onRetry={retryRemainingPages} />
            ) : null
          }
          ListFooterComponent={
            isLoadingRemainingPages ? (
              <Loading
                size="small"
                message={t('recipes.myRecipesSearchingAll')}
                style={styles.loadingRemaining}
              />
            ) : (
              <PaginationFooter
                hasMore={hasMore}
                isFetchingMore={isLoadingMore}
                itemCount={filteredRecipes.length}
              />
            )
          }
          contentContainerStyle={[styles.listContent, listInset]}
          {...FLASHLIST_DEFAULTS.fullScreen}
        />
      )}
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  loadingRemaining: {
    flex: 0,
  },
  listContent: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.smPlus,
  },
}));
