import React, { useMemo, useCallback, useState } from 'react';
import { View, Image, Alert } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListTemplate, SearchBarAction, HeaderAction } from '#components';
import { useMyRecipesQuery, useDeleteRecipeMutation } from '#generated';

export const RecipeMain: React.FC = () => {
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch user's saved recipes from backend
  const { data, loading, refetch } = useMyRecipesQuery({
    fetchPolicy: 'cache-and-network',
  });
  const recipes = useMemo(() => data?.myRecipes?.recipes || [], [data]);

  // Delete recipe mutation
  const [deleteRecipeMutation] = useDeleteRecipeMutation({
    refetchQueries: ['MyRecipes'],
    awaitRefetchQueries: true,
  });

  // Transform recipes to list items format
  const items = useMemo(() => {
    return recipes.map((recipe: any) => ({
      id: recipe.id,
      title: recipe.name,
      subtitle: `${recipe.servings} servings • ${
        recipe.totalTimeMinutes || 'N/A'
      } min`,
      badge: undefined,
      leftElement: recipe.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: recipe.imageUrl }} style={styles.leftImage} />
        </View>
      ) : undefined,
    }));
  }, [recipes]);

  const handleSearchRecipes = useCallback(() => {
    navigate('RecipeSearch', {});
  }, [navigate]);

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
          backgroundColor: '#fff',
        },
      ] as SearchBarAction[],
    }),
    [handleSearchRecipes, theme.colors.primary],
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
