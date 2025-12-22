import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Image, Alert, Text, TouchableOpacity, Pressable } from 'react-native';
import { useAppNavigation } from '#hooks';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ListTemplate, HeaderAction, RecipesHeader, FolderPicker, TagPicker } from '#components';
import {
  useUnfavoriteRecipeMutation,
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#generated';
import { useSavedRecipes, useRecipeFolders, useRecipeTags } from '#/hooks/recipe';
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

  // Filter state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Get user profile and notification data for header
  const { profile } = useProfileData();
  const unreadCount = useStore(state => state.unreadCount);

  // Fetch folders and tags for filtering
  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();

  // State for random recipes (shown when user has no saved recipes)
  const [randomRecipes, setRandomRecipes] = useState<RecipeInformation[]>([]);
  const [loadingRandom, setLoadingRandom] = useState(false);

  // Ref to track if we've already fetched random recipes (prevents infinite loop)
  const hasFetchedRandom = useRef(false);

  // Fetch user's saved/favorited recipes from backend
  const {
    recipes,
    loading,
    refetch,
  } = useSavedRecipes();

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

  // Filter recipes based on search query, folder, and tags
  const filteredRecipes = useMemo(() => {
    let result = recipes;

    // Filter by folder
    if (selectedFolder) {
      result = result.filter(recipe => recipe.folder === selectedFolder);
    }

    // Filter by tags (recipe must have ALL selected tags)
    if (selectedTags.length > 0) {
      result = result.filter(recipe => {
        const recipeTags = recipe.tags || [];
        return selectedTags.every(tag => recipeTags.includes(tag));
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(recipe => {
        const name = recipe.name?.toLowerCase() || '';
        const description = recipe.description?.toLowerCase() || '';
        return name.includes(query) || description.includes(query);
      });
    }

    return result;
  }, [recipes, searchQuery, selectedFolder, selectedTags]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedFolder(null);
    setSelectedTags([]);
    setSearchQuery('');
  }, []);

  // Unfavorite (remove from saved) recipe mutation
  const [unfavoriteRecipeMutation] = useUnfavoriteRecipeMutation({
    // Use cache updates instead of refetchQueries for better performance and offline support
    update: (cache, { data }, { variables }) => {
      if (!data?.unfavoriteRecipe || !variables?.recipeId) return;

      // Remove from mySavedRecipes array
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing) return existing;
          return {
            ...existing,
            mySavedRecipes: existing.mySavedRecipes.filter(
              sr => sr.recipe.id !== variables.recipeId,
            ),
          };
        },
      );
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
        // For saved recipes, use recipeId for navigation; for external, use id
        id: showRandomRecipes ? recipe.id : recipe.recipeId,
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

  const handleRemoveRecipe = useCallback(
    async (recipeId: string) => {
      try {
        await unfavoriteRecipeMutation({
          variables: { recipeId },
        });
      } catch (error) {
        console.error('Failed to remove recipe:', error);
        Alert.alert('Error', 'Failed to remove recipe. Please try again.');
      }
    },
    [unfavoriteRecipeMutation],
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

  // Check if any filters are active
  const hasActiveFilters = selectedFolder !== null || selectedTags.length > 0;

  // Filter Header Component - shown when user has saved recipes
  const FilterHeader = useMemo(() => {
    // Don't show filters when showing random recipes or no folders/tags available
    if (showRandomRecipes || (folders.length === 0 && availableTags.length === 0)) {
      return SuggestedHeader;
    }

    return (
      <View style={styles.filterContainer}>
        {/* Filter Row with Folder and Tags */}
        <View style={styles.filterRow}>
          {/* Folder Filter */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFolderPicker(true)}>
            <Icon
              library="Feather"
              name="folder"
              size={16}
              color={selectedFolder ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.filterButtonText,
                selectedFolder && styles.filterButtonTextActive,
              ]}
              numberOfLines={1}>
              {selectedFolder || 'All Folders'}
            </Text>
            <Icon
              library="Feather"
              name="chevron-down"
              size={16}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowTagPicker(true)}>
              <Icon
                library="Feather"
                name="tag"
                size={16}
                color={selectedTags.length > 0 ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  selectedTags.length > 0 && styles.filterButtonTextActive,
                ]}
                numberOfLines={1}>
                {selectedTags.length > 0
                  ? `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}`
                  : 'All Tags'}
              </Text>
              <Icon
                library="Feather"
                name="chevron-down"
                size={16}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [
    showRandomRecipes,
    folders.length,
    availableTags.length,
    selectedFolder,
    selectedTags,
    hasActiveFilters,
    handleClearFilters,
    theme.colors.primary,
    theme.colors.textSecondary,
    SuggestedHeader,
  ]);

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
        onItemDelete={showRandomRecipes ? undefined : handleRemoveRecipe}
        onRefresh={handleRefresh}
        loading={loading || loadingRandom}
        hasNoData={false}
        showUserHeader={false}
        showHeader={false}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
        ListHeaderComponent={FilterHeader}
      />

      {/* Folder Picker Modal - filter only, no folder creation */}
      <FolderPicker
        visible={showFolderPicker}
        folders={folders}
        selectedFolder={selectedFolder}
        onSelect={folder => {
          setSelectedFolder(folder);
          setShowFolderPicker(false);
        }}
        onCancel={() => setShowFolderPicker(false)}
        allowCreate={false}
      />

      {/* Tag Picker Modal - multi-select filter */}
      <TagPicker
        visible={showTagPicker}
        tags={availableTags}
        selectedTags={selectedTags}
        onSelect={tags => {
          setSelectedTags(tags);
          setShowTagPicker(false);
        }}
        onCancel={() => setShowTagPicker(false)}
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
  filterContainer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.full,
    gap: theme.spacing.xs,
  },
  filterButtonText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    maxWidth: 100,
  },
  filterButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  clearButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    marginLeft: 'auto',
  },
  clearButtonText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
