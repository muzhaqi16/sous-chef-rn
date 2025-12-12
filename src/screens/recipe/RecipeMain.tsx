import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Image, Alert, Text, TouchableOpacity, Pressable } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListTemplate, HeaderAction, RecipesHeader } from '#components';
import { useDeleteRecipeMutation } from '#generated';
import { useRecipeManagement } from '#/hooks/recipe/useRecipeManagement';
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { createRemoveFromQueryFieldUpdater } from '#/apollo/utils';
import { spoonacularService } from '#/services/recipeApi';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { Icon } from '#/utils';
import { useTabBarActions } from '#context';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useStore } from '#store';

// PERFORMANCE: Memoize screen component to prevent unnecessary re-renders
export const RecipeMain: React.FC = React.memo(() => {
  const { navigate, isFocused } = useAppNavigation();
  const { theme } = useUnistyles();
  const { setAddProps } = useTabBarActions();
  const [searchQuery, setSearchQuery] = useState('');

  // Get user profile and notification data for header
  const { profile } = useProfileData();
  const unreadCount = useStore(state => state.unreadCount);

  // State for random recipes (shown when user has no saved recipes)
  const [randomRecipes, setRandomRecipes] = useState<RecipeInformation[]>([]);
  const [loadingRandom, setLoadingRandom] = useState(false);

  // Ref to track if we've already fetched random recipes (prevents infinite loop)
  const hasFetchedRandom = useRef(false);

  // Fetch user's saved recipes from backend with pagination
  const {
    recipes,
    loading,
    refetch,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useRecipeManagement();

  // Fetch random recipes ONLY ONCE when user has no saved recipes
  useEffect(() => {
    const fetchRandomRecipes = async () => {
      // Only fetch if:
      // 1. User has no saved recipes
      // 2. Initial loading is complete
      // 3. We haven't already fetched random recipes
      // 4. We're not currently loading random recipes
      if (
        recipes.length > 0 ||
        loading ||
        hasFetchedRandom.current ||
        loadingRandom
      ) {
        return;
      }

      hasFetchedRandom.current = true;
      setLoadingRandom(true);
      try {
        const random = await spoonacularService.getRandomRecipes({ number: 10 });
        setRandomRecipes(random);
      } catch (error) {
        console.error('Failed to fetch random recipes:', error);
        // Reset flag so user can retry
        hasFetchedRandom.current = false;
      } finally {
        setLoadingRandom(false);
      }
    };

    fetchRandomRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes.length, loading]); // Intentionally exclude loadingRandom to prevent infinite loop

  // Clear random recipes when user saves their first recipe
  useEffect(() => {
    if (recipes.length > 0 && randomRecipes.length > 0) {
      setRandomRecipes([]);
      hasFetchedRandom.current = false; // Reset so it can fetch again if recipes are deleted
    }
  }, [recipes.length, randomRecipes.length]);

  // Register add button action - navigate to recipe search
  useEffect(() => {
    if (isFocused) {
      setAddProps(() => navigate('RecipeSearch'), true);
    }
    return () => {
      setAddProps(undefined, false);
    };
  }, [isFocused, setAddProps, navigate]);

  // Manual refresh to get new random recipes
  const handleRefreshRandom = useCallback(async () => {
    if (loadingRandom) return;

    setLoadingRandom(true);
    try {
      const random = await spoonacularService.getRandomRecipes({ number: 10 });
      setRandomRecipes(random);
    } catch (error) {
      console.error('Failed to fetch random recipes:', error);
      Alert.alert('Error', 'Failed to load recipe suggestions. Please try again.');
    } finally {
      setLoadingRandom(false);
    }
  }, [loadingRandom]);

  // Determine if we should show random recipes
  const showRandomRecipes = recipes.length === 0 && randomRecipes.length > 0;

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

  // Transform filtered recipes to list items format (handles both saved and random)
  const items = useMemo(() => {
    // Use random recipes if showing them, otherwise use filtered saved recipes
    const recipesToShow = showRandomRecipes ? randomRecipes : filteredRecipes;

    return recipesToShow.map((recipe: any) => {
      // Handle both saved (backend) and random (external) recipe formats
      const isExternalRecipe = !recipe.name && recipe.title; // External recipes use 'title'
      const name = recipe.name || recipe.title;
      const imageUrl = recipe.imageUrl || recipe.image;
      const servings = recipe.servings;

      // Calculate total time with fallback logic
      const totalTime =
        recipe.totalTimeMinutes ||
        recipe.readyInMinutes ||
        (recipe.prepTimeMinutes && recipe.cookTimeMinutes
          ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
          : recipe.prepTimeMinutes || recipe.cookTimeMinutes || null);

      return {
        id: recipe.id,
        title: name,
        subtitle: `${servings} servings${
          totalTime ? ` • ${totalTime} min` : ''
        }`,
        badge: showRandomRecipes ? 'Suggested' : undefined,
        leftElement: imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.leftImage}
            />
          </View>
        ) : undefined,
        // Store whether this is an external recipe for navigation
        isExternal: isExternalRecipe || showRandomRecipes,
      };
    });
  }, [filteredRecipes, randomRecipes, showRandomRecipes]);

  const handleSearchRecipes = useCallback(() => {
    navigate('RecipeSearch', { initialQuery: searchQuery });
  }, [navigate, searchQuery]);

  const handleRefresh = async () => {
    if (showRandomRecipes) {
      await handleRefreshRandom();
    } else {
      await refetch();
    }
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

  // Search bar actions - use inner icon pattern for consistency with Pantry/Shopping List
  const searchBarActions = useMemo(
    () => ({
      showSearchIcon: true,
      innerRightIcon: (
        <Pressable onPress={handleSearchRecipes} hitSlop={8}>
          <Icon
            name="search"
            size={18}
            color={theme.colors.primary}
            library="Feather"
          />
        </Pressable>
      ),
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

  // Handle item press - navigate differently for saved vs random recipes
  const handleItemPress = useCallback(
    (id: string | number) => {
      if (showRandomRecipes) {
        // Random recipe from Spoonacular - navigate with external source params
        navigate('RecipeDetail', {
          externalSource: 'SPOONACULAR',
          externalId: String(id),
        });
      } else {
        // Saved recipe - navigate with recipeId
        navigate('RecipeDetail', { recipeId: String(id) });
      }
    },
    [navigate, showRandomRecipes],
  );

  // Suggested Recipes Header Component - shown when displaying random recipes
  const SuggestedHeader = useMemo(() => {
    if (!showRandomRecipes) return null;
    return (
      <View style={styles.suggestedHeader}>
        <View style={styles.suggestedTextContainer}>
          <Text style={styles.suggestedTitle}>Need inspiration?</Text>
          <Text style={styles.suggestedSubtitle}>
            Here are some recipe ideas to try
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshRandom}
          disabled={loadingRandom}
          activeOpacity={0.7}
        >
          <Icon
            name="refresh"
            size={20}
            color={loadingRandom ? theme.colors.textSecondary : theme.colors.primary}
            library="Ionicons"
          />
        </TouchableOpacity>
      </View>
    );
  }, [showRandomRecipes, handleRefreshRandom, loadingRandom, theme.colors.textSecondary, theme.colors.primary]);

  // Footer component for pagination
  return (
    <View style={styles.container} testID="recipes-screen">
      <RecipesHeader
        avatarUrl={profile?.avatar}
        notificationCount={unreadCount}
        onAvatarPress={() => navigate('Notifications')}
      />
      <ListTemplate
        items={items}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={handleItemPress}
        onItemDelete={showRandomRecipes ? undefined : handleDeleteRecipe}
        onRefresh={handleRefresh}
        loading={loading || loadingRandom}
        hasNoData={false}
        showUserHeader={false}
        showHeader={false}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
        onEndReached={showRandomRecipes ? undefined : loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={SuggestedHeader}
        ListFooterComponent={
          showRandomRecipes ? undefined : (
            <PaginationFooter
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              loading={loading}
              itemCount={recipes.length}
              loadingText="Loading more recipes..."
            />
          )
        }
      />
    </View>
  );
});

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestedTextContainer: {
    flex: 1,
  },
  suggestedTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  suggestedSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.full,
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
