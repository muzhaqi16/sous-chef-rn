import React, { useState } from 'react';
import { View } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ItemList } from '#components/organisms/ItemList';
import { SearchBar } from '#components/molecules/SearchBar';
import { Header } from '#components/molecules/Header';
import { useMutation } from '@apollo/client/react';
import {
  DeleteRecipeDocument,
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { useRecipeManagement } from '#features/recipes/hooks/useRecipeManagement';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { CachedImage } from '#components/atoms/CachedImage';
import { alertService } from '#services/alertService';
import { executeMutation } from '#utils/compilerSafeWrappers';

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
      if (!data?.deleteRecipe?.success || !variables?.id) return;
      cache.updateQuery<MyRecipesQuery>(
        { query: MyRecipesDocument },
        existing => {
          if (!existing?.recipes) return existing;
          return {
            ...existing,
            recipes: {
              ...existing.recipes,
              edges: existing.recipes.edges.filter(
                edge => edge.node.id !== variables.id,
              ),
              totalCount: (existing.recipes.totalCount ?? 0) - 1,
            },
          };
        },
      );
    },
  });

  // Filter by search query
  const filteredRecipes = (() => {
    if (!searchQuery.trim()) return myRecipes;
    const query = searchQuery.toLowerCase();
    return myRecipes.filter((recipe: any) => {
      const name = recipe.name?.toLowerCase() || '';
      const description = recipe.description?.toLowerCase() || '';
      return name.includes(query) || description.includes(query);
    });
  })();

  // Transform to list items
  const items = filteredRecipes.map((recipe: any) => {
    const totalTime =
      recipe.totalTimeMinutes ||
      (recipe.prepTimeMinutes && recipe.cookTimeMinutes
        ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
        : recipe.prepTimeMinutes || recipe.cookTimeMinutes || null);

    return {
      id: String(recipe.id),
      title: recipe.name,
      subtitle: `${recipe.servings} servings${
        totalTime ? ` \u2022 ${totalTime} min` : ''
      }`,
      leftElement: recipe.imageUrl ? (
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage
            uri={recipe.imageUrl}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      ) : undefined,
    };
  });

  const handleItemPress = (id: string | number) => {
    toRecipeDetail({ recipeId: String(id) });
  };

  const handleEditRecipe = (id: string) => {
    toRecipeEdit({ recipeId: id });
  };

  const handleDeleteRecipe = async (id: string) => {
    await executeMutation(
      () => deleteRecipeMutation({ variables: { id } }),
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

  const emptyStateConfig: {
    icon: 'create-outline';
    title: string;
    description: string;
    action: { label: string; onPress: () => void };
  } = {
    icon: 'create-outline',
    title: 'No recipes yet',
    description: 'Create your first recipe',
    action: {
      label: 'Create Recipe',
      onPress: toRecipeCreate,
    },
  };

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
      <ItemList
        items={items}
        onItemPress={handleItemPress}
        onItemDelete={handleDeleteRecipe}
        onItemEdit={handleEditRecipe}
        onRefresh={handleRefresh}
        emptyState={emptyStateConfig}
      />
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
