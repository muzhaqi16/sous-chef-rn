import React, { useMemo, useCallback, useState } from 'react';
import { View, Image, Alert, Text, ActivityIndicator } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListTemplate, SearchBarAction, HeaderAction } from '#components';
import { useDeleteRecipeMutation } from '#generated';
import { useRecipeManagement } from '#/hooks/recipe/useRecipeManagement';

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
    refetchQueries: ['MyRecipes'],
    awaitRefetchQueries: true,
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
  const ListFooter = useMemo(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.footerText}>Loading more recipes...</Text>
        </View>
      );
    }
    if (hasMore && !loading && recipes.length > 0) {
      return (
        <View style={styles.footerHint}>
          <Text style={styles.footerHintText}>Scroll to load more</Text>
        </View>
      );
    }
    return null;
  }, [isLoadingMore, hasMore, loading, recipes.length, theme.colors.primary]);

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
        ListFooterComponent={ListFooter}
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
  footerLoader: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  footerText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  footerHint: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  footerHintText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
  },
}));
