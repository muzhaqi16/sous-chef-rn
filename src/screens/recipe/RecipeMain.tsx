import React, { useMemo, useCallback, useState } from 'react';
import { View, Image, Alert } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListTemplate, SearchBarAction, HeaderAction } from '#components';
import { useDeleteRecipeMutation } from '#generated';
import { useRecipeManagement } from '#/hooks/recipe/useRecipeManagement';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { createRemoveFromQueryFieldUpdater } from '#/apollo/utils';

export const RecipeMain: React.FC = () => {
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch user's saved recipes from backend with pagination
  const {
    recipes,
    loading,
    refetch,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useRecipeManagement();

  // Filter recipes based on search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;

    const query = searchQuery.toLowerCase();
    return recipes.filter((recipe: any) => {
      const name = recipe.name?.toLowerCase() || '';
      const description = recipe.description?.toLowerCase() || '';
      return name.includes(query) || description.includes(query);
    });
  }, [recipes, searchQuery]);

  // Delete recipe mutation
  const [deleteRecipeMutation] = useDeleteRecipeMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.deleteRecipe || !variables) return;

      try {
        const removeFromRecipesCache = createRemoveFromQueryFieldUpdater(
          'recipes',
          'Recipe',
        );
        removeFromRecipesCache(cache, variables.id, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for deleteRecipe:', error);
      }
    },
  });

  // Transform filtered recipes to list items format
  const items = useMemo(() => {
    return filteredRecipes.map((recipe: any) => {
      // Calculate total time with fallback logic
      const totalTime =
        recipe.totalTimeMinutes ||
        (recipe.prepTimeMinutes && recipe.cookTimeMinutes
          ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
          : recipe.prepTimeMinutes || recipe.cookTimeMinutes || null);

      return {
        id: recipe.id,
        title: recipe.name,
        subtitle: `${recipe.servings} servings${
          totalTime ? ` • ${totalTime} min` : ''
        }`,
        badge: undefined,
        leftElement: recipe.imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: recipe.imageUrl }}
              style={styles.leftImage}
            />
          </View>
        ) : undefined,
      };
    });
  }, [filteredRecipes]);

  const handleSearchRecipes = useCallback(() => {
    navigate('RecipeSearch', { initialQuery: searchQuery });
  }, [navigate, searchQuery]);

  const handleRefresh = async () => {
    await refetch();
  };

  const handleDeleteRecipe = useCallback(
    async (id: string) => {
      try {
        await deleteRecipeMutation({
          variables: { id },
        });
      } catch (error) {
        console.error('Failed to delete recipe:', error);
        Alert.alert('Error', 'Failed to delete recipe. Please try again.');
      }
    },
    [deleteRecipeMutation],
  );

  // Header actions
  const headerActions = useMemo(
    () => ({
      left: [] as HeaderAction[],
      right: [] as HeaderAction[],
    }),
    [],
  );

  // Search bar actions
  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'search',
          onPress: handleSearchRecipes,
          color: theme.colors.primary,
          backgroundColor: theme.colors.surface,
        },
      ] as SearchBarAction[],
    }),
    [handleSearchRecipes, theme.colors.primary, theme.colors.surface],
  );

  const emptyStateConfig = {
    icon: 'book',
    title: 'No saved recipes',
    description: 'Search for recipes and save your favorites',
    action: {
      label: 'Search Recipes',
      onPress: handleSearchRecipes,
    },
  };

  // Footer component for pagination
  return (
    <View style={styles.container}>
      <ListTemplate
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={id => navigate('RecipeDetail', { recipeId: id })}
        onItemDelete={handleDeleteRecipe}
        onRefresh={handleRefresh}
        loading={loading}
        hasNoData={false}
        showHeader={false}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <PaginationFooter
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            loading={loading}
            itemCount={recipes.length}
            loadingText="Loading more recipes..."
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  leftImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
    elevation: 2,
  },
}));
