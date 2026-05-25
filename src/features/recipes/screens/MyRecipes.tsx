import React, { useState } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { SearchBar } from '#components/molecules/SearchBar';
import { Header } from '#components/molecules/Header';
import { EmptyState } from '#components/base/EmptyState';
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
import { executeMutation } from '#utils/compilerSafeWrappers';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

const keyExtractor = (item: MyRecipeNode) => item.id;

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
  const { toRecipeDetail, toRecipeEdit, toRecipeCreate, goBack } =
    useAppNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    state: { recipes: myRecipes },
    actions: { refetch },
  } = useRecipeManagement();

  const [deleteRecipeMutation] = useMutation(DeleteRecipeDocument, {
    update: (cache, { data }, { variables }) => {
      if (
        data?.deleteRecipe?.__typename !== 'DeleteRecipePayload' ||
        !variables?.input?.id
      ) {
        return;
      }
      cache.updateQuery<MyRecipesQuery>(
        { query: MyRecipesDocument },
        existing => {
          if (!existing?.recipes) return existing;
          return {
            ...existing,
            recipes: {
              ...existing.recipes,
              edges: existing.recipes.edges.filter(
                edge => edge.node.id !== variables.input.id,
              ),
              totalCount: (existing.recipes.totalCount ?? 0) - 1,
            },
          };
        },
      );
    },
  });

  const handleItemPress = (id: string) => {
    toRecipeDetail({ recipeId: id });
  };

  const handleEditRecipe = (id: string) => {
    toRecipeEdit({ recipeId: id });
  };

  const handleDeleteRecipe = async (id: string) => {
    await executeMutation(
      () => deleteRecipeMutation({ variables: { input: { id } } }),
      (error: unknown) => {
        console.error('Failed to delete recipe:', error);
        alertService.alert(
          'Error',
          'Failed to delete recipe. Please try again.',
        );
      },
    );
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
      <Header title="My Recipes" onBack={goBack} />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search my recipes..."
          showSearchIcon
        />
      </View>
      {myRecipes.length === 0 ? (
        <EmptyState
          icon="create-outline"
          title="No recipes yet"
          description="Create your first recipe"
          action={{ label: 'Create Recipe', onPress: toRecipeCreate }}
        />
      ) : (
        <FlashList
          data={myRecipes}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onRefresh={handleRefresh}
          refreshing={false}
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
}));
