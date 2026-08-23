import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList } from '@shopify/flash-list';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { useApolloClient, useFragment } from '@apollo/client/react';
import { SearchBar } from '#components/molecules/SearchBar';
import { Header } from '#components/molecules/Header';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { useMutation } from '@apollo/client/react';
import {
  DeleteRecipeDocument,
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { MyRecipeCard } from '#features/recipes/components/MyRecipeCard';
import { MyRecipeCard_RecipeFragmentDoc } from '#features/recipes/components/MyRecipeCard.generated';
import {
  useRecipeManagement,
  type MyRecipeNode,
} from '#features/recipes/hooks/useRecipeManagement';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { alertService } from '#services/alertService';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

const keyExtractor = (item: MyRecipeNode) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

/**
 * Inline cell adapter — the filter helper passes the node ref straight through.
 * The cell needs to consult fields from `MyRecipeCard_recipe` (notably `name`
 * and `description`) for search filtering, so it wraps `MyRecipeCard` with a
 * pre-flight `useFragment` peek used to honor the search query.
 */
const MyRecipeRow: React.FC<{
  recipe: MyRecipeNode;
  searchQuery: string;
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ recipe, searchQuery, onPress, onEdit, onDelete }) => {
  // Pre-flight cache read for the search filter — same fragment the card
  // subscribes to, so this is free at runtime.
  const { data, complete } = useFragment({
    fragment: MyRecipeCard_RecipeFragmentDoc,
    fragmentName: 'MyRecipeCard_recipe',
    from: recipe,
  });

  if (!complete) return null;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    const name = (data.name ?? '').toLowerCase();
    const description = (data.description ?? '').toLowerCase();
    if (!name.includes(q) && !description.includes(q)) return null;
  }

  return (
    <MyRecipeCard
      recipeRef={recipe}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};

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

  const dataState = useDataState({
    loading,
    error,
    hasResult,
    skipped,
    isEmpty: myRecipes.length === 0,
  });

  const apolloClient = useApolloClient();
  const [deleteRecipeMutation] = useMutation(DeleteRecipeDocument);

  const removeRecipeEdge = (id: string) => {
    apolloClient.cache.updateQuery<MyRecipesQuery>(
      { query: MyRecipesDocument },
      existing => {
        if (!existing?.recipes) return existing;
        const present = existing.recipes.edges.some(
          edge => edge.node.id === id,
        );
        if (!present) return existing;
        return {
          ...existing,
          recipes: {
            ...existing.recipes,
            edges: existing.recipes.edges.filter(edge => edge.node.id !== id),
            totalCount: (existing.recipes.totalCount ?? 0) - 1,
          },
        };
      },
    );
  };

  const handleItemPress = (id: string) => {
    toRecipeDetail({ recipeId: id });
  };

  const handleEditRecipe = (id: string) => {
    toRecipeEdit({ recipeId: id });
  };

  const handleDeleteRecipe = async (id: string) => {
    // Local-first: remove from the list BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // surfaces as NotFound, which the queue drops).
    try {
      removeRecipeEdge(id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Recipe (optimistic)',
      });
    }

    let result;
    try {
      result = await deleteRecipeMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'deleteRecipe' });
      alertService.alert(t('labels.error'), t('recipes.deleteRecipeFailed'));
    }
    // A rejection means the recipe still exists server-side — alert (the silent
    // revert would otherwise just snap the recipe back) and refetch to restore
    // the authoritative list. A queued result keeps the removal and replays
    // later. A null result (transport throw) already alerted via onError above.
    const wasRejected = alertIfRejected(
      result,
      t('recipes.deleteRecipeFailed'),
    );
    if (!result || wasRejected) {
      await refetch();
    }
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const renderItem = ({ item }: { item: MyRecipeNode }) => (
    <MyRecipeRow
      recipe={item}
      searchQuery={searchQuery}
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
      {dataState !== 'ready' ? (
        <DataStateView
          state={dataState}
          onRetry={handleRefresh}
          empty={{
            icon: 'create-outline',
            title: t('recipes.myRecipesEmptyTitle'),
            description: t('recipes.myRecipesEmptyDescription'),
            action: {
              label: t('recipes.createRecipe'),
              onPress: toRecipeCreate,
            },
          }}
        />
      ) : (
        <FlashList
          data={myRecipes}
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
    paddingTop: theme.spacing['2.5'],
  },
}));
