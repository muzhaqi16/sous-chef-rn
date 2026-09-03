import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { SearchBar } from '#components/molecules/SearchBar';
import { Header } from '#components/molecules/Header';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { useDeleteRecipe } from '#features/recipes/hooks/useDeleteRecipe';
import { MyRecipeCard } from '#features/recipes/components/MyRecipeCard';
import {
  useRecipeManagement,
  type MyRecipeNode,
} from '#features/recipes/hooks/useRecipeManagement';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { alertService } from '#services/alertService';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { useLocalSearch } from '#hooks/search/useLocalSearch';

const keyExtractor = (item: MyRecipeNode) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

export const MyRecipes: React.FC = () => {
  useScreenTransition('MyRecipes');
  const { t } = useTranslation();
  const { toRecipeDetail, toRecipeEdit, toRecipeCreate, goBack } =
    useAppNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    state: { recipes: myRecipes, loading, error, hasResult, skipped },
    actions: { refetch },
  } = useRecipeManagement();

  // Filtered at the parent, never inside the cell: a virtualized list cannot
  // absorb rows that return null — the cell, its layout slot and its fragment
  // subscription all survive. `name`/`description` are selected on the query's
  // node for exactly this (see recipe.graphql).
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

  // A search that matches nothing is not an empty library. `isEmpty` above
  // reads the UNFILTERED list, so without this branch a non-matching query left
  // `dataState` at 'ready' and the list rendered an empty array — a blank
  // screen with no explanation. Offering "create your first recipe" to someone
  // who has ten would be the other half of the same mistake.
  const searchTerm = searchQuery.trim();
  const emptyProps =
    myRecipes.length > 0
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
            onPress: toRecipeCreate,
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
    const { result } = await deleteRecipe(id);
    // A rejection means the recipe still exists server-side — alert (a silent
    // revert would just snap the row back) and refetch to restore the
    // authoritative list. A queued result keeps the removal and replays later.
    const wasRejected = alertIfRejected(
      result,
      t('recipes.deleteRecipeFailed'),
    );
    if (!result || wasRejected) {
      if (!result) {
        alertService.alert(t('labels.error'), t('recipes.deleteRecipeFailed'));
      }
      await refetch();
    }
  };

  const handleRefresh = async () => {
    await refetch();
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
    <View style={styles.container} testID="my-recipes-screen">
      <Header title={t('recipes.myRecipesTitle')} onBack={goBack} />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('recipes.myRecipesSearchPlaceholder')}
          showSearchIcon
        />
      </View>
      {dataState !== 'ready' || filteredRecipes.length === 0 ? (
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
          onRefresh={handleRefresh}
          refreshing={false}
          contentContainerStyle={styles.listContent}
          {...FLASHLIST_DEFAULTS.fullScreen}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  listContent: {
    paddingTop: theme.spacing.smPlus,
  },
}));
