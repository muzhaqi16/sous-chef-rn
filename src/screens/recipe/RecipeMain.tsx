import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { View, Image, Alert, Text, TouchableOpacity, Pressable } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ItemList } from '#components/organisms/ItemList';
import { SearchBar } from '#components/molecules/SearchBar';
import { RecipesHeader } from '#components/molecules/RecipesHeader';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { TagPicker } from '#components/molecules/TagPicker';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import {
  useUnfavoriteRecipeMutation,
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#generated';
import { useSavedRecipes } from '#/hooks/recipe/useSavedRecipes';
import { useRecipeFolders } from '#/hooks/recipe/useRecipeFolders';
import { useRecipeTags } from '#/hooks/recipe/useRecipeTags';
import { useFolderActions } from '#/hooks/recipe/useFolderActions';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { Icon } from '#/utils/iconUtils';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useStore } from '#store';

// PERFORMANCE: Memoize screen component to prevent unnecessary re-renders
export const RecipeMain: React.FC = React.memo(() => {
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();
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

  // Folder management actions
  const {
    renameFolder,
    deleteFolder,
    loading: folderActionLoading,
  } = useFolderActions();

  // State for random recipes (shown when user has no saved recipes)
  const [randomRecipes, setRandomRecipes] = useState<RecipeInformation[]>([]);
  const [loadingRandom, setLoadingRandom] = useState(false);

  // Ref to track if we've already fetched random recipes (prevents infinite loop)
  const hasFetchedRandom = useRef(false);

  // Fetch user's saved/favorited recipes from backend
  const { recipes, loading, refetch } = useSavedRecipes();

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
        const random = await spoonacularService.getRandomRecipes({
          number: 10,
        });
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
  useTabBarAddButton(() => navigate('RecipeSearch'));

  // Manual refresh to get new random recipes
  const handleRefreshRandom = useCallback(async () => {
    if (loadingRandom) return;

    setLoadingRandom(true);
    try {
      const random = await spoonacularService.getRandomRecipes({ number: 10 });
      setRandomRecipes(random);
    } catch (error) {
      console.error('Failed to fetch random recipes:', error);
      Alert.alert(
        'Error',
        'Failed to load recipe suggestions. Please try again.',
      );
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

    // Filter by tags (recipe must have ANY of the selected tags)
    if (selectedTags.length > 0) {
      result = result.filter(recipe => {
        const recipeTags = recipe.tags || [];
        return selectedTags.some(tag => recipeTags.includes(tag));
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
        id: String(showRandomRecipes ? recipe.id : recipe.recipeId),
        title: name,
        subtitle: `${servings} servings${
          totalTime ? ` • ${totalTime} min` : ''
        }`,
        badge: showRandomRecipes ? { text: 'Suggested' } : undefined,
        leftElement: imageUrl ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.leftImage} />
          </View>
        ) : undefined,
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

  // Search bar inner right icon - navigate to recipe search
  const searchBarInnerRightIcon = useMemo(
    () => (
      <Pressable onPress={handleSearchRecipes} hitSlop={8}>
        <Icon
          name="search"
          size={18}
          color={theme.colors.primary}
          library="Feather"
        />
      </Pressable>
    ),
    [handleSearchRecipes, theme.colors.primary],
  );

  const emptyStateConfig = {
    icon: 'book' as const,
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
            color={
              loadingRandom ? theme.colors.textSecondary : theme.colors.primary
            }
            library="Ionicons"
          />
        </TouchableOpacity>
      </View>
    );
  }, [
    showRandomRecipes,
    handleRefreshRandom,
    loadingRandom,
    theme.colors.textSecondary,
    theme.colors.primary,
  ]);

  // Check if any filters are active
  const hasActiveFilters = selectedFolder !== null || selectedTags.length > 0;

  // Define filter tabs with modal triggers
  const filterTabs = useMemo(() => {
    const tabs: FilterTabConfig<string>[] = [
      {
        id: 'all',
        label: 'All',
      },
    ];

    // Add folder pill if folders exist
    if (folders.length > 0) {
      tabs.push({
        id: 'folder',
        label: selectedFolder || 'Folders',
        icon: '📁',
        onPress: () => setShowFolderPicker(true),
        showDropdownIndicator: true,
      });
    }

    // Add tags pill if tags exist
    if (availableTags.length > 0) {
      tabs.push({
        id: 'tags',
        label:
          selectedTags.length > 0
            ? `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}`
            : 'Tags',
        icon: '🏷️',
        onPress: () => setShowTagPicker(true),
        showDropdownIndicator: true,
      });
    }

    return tabs;
  }, [folders.length, availableTags.length, selectedFolder, selectedTags]);

  // Calculate counts for filter tabs
  const filterCounts = useMemo(
    () => ({
      all: recipes.length,
      folder: folders.length,
      tags: availableTags.length,
    }),
    [recipes.length, folders.length, availableTags.length],
  );

  // Compute which tabs have active filters (shown with subtle filtered styling)
  const filteredTabs = useMemo(() => {
    const filtered: string[] = [];
    if (selectedFolder) filtered.push('folder');
    if (selectedTags.length > 0) filtered.push('tags');
    return filtered;
  }, [selectedFolder, selectedTags.length]);

  // "All" is only active when no filters are applied; otherwise no tab is active
  const activeFilterTab = filteredTabs.length === 0 ? 'all' : '';

  // Filter Header Component - shown when user has saved recipes
  const FilterHeader = useMemo(() => {
    // Show suggested header when showing random recipes
    if (showRandomRecipes) {
      return SuggestedHeader;
    }

    // Don't show filter tabs if no folders/tags available
    if (folders.length === 0 && availableTags.length === 0) {
      return null;
    }

    return (
      <FilterTabs
        tabs={filterTabs}
        activeTabId={activeFilterTab}
        filteredTabIds={filteredTabs}
        onTabChange={tabId => {
          if (tabId === 'all') {
            handleClearFilters();
          }
        }}
        counts={filterCounts}
        actionButton={{
          icon: 'x',
          iconLibrary: 'Feather',
          onPress: handleClearFilters,
          testID: 'recipe-clear-filters',
          disabled: !hasActiveFilters,
        }}
        testIDPrefix="recipe-filter-tab"
      />
    );
  }, [
    showRandomRecipes,
    folders.length,
    availableTags.length,
    filterTabs,
    activeFilterTab,
    filteredTabs,
    filterCounts,
    hasActiveFilters,
    handleClearFilters,
    SuggestedHeader,
  ]);

  return (
    <View style={styles.container} testID="recipes-screen">
      <RecipesHeader
        avatarUrl={profile?.avatar}
        notificationCount={unreadCount}
        onAvatarPress={() => navigate('Notifications')}
      />
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search recipes..."
          showSearchIcon
          innerRightIcon={searchBarInnerRightIcon}
        />
      </View>
      <ItemList
        items={items}
        onItemPress={handleItemPress}
        onItemDelete={showRandomRecipes ? undefined : handleRemoveRecipe}
        onRefresh={handleRefresh}
        ListHeaderComponent={FilterHeader}
        emptyState={emptyStateConfig}
      />

      {/* Folder Picker Modal - filter only, no folder creation, with rename/delete */}
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
        onRenameFolder={async (oldName, newName) => {
          const success = await renameFolder(oldName, newName);
          if (success && selectedFolder === oldName) {
            setSelectedFolder(newName);
          }
          return success;
        }}
        onDeleteFolder={async folderName => {
          const success = await deleteFolder(folderName);
          if (success && selectedFolder === folderName) {
            setSelectedFolder(null);
          }
          return success;
        }}
        folderActionLoading={folderActionLoading}
      />

      {/* Tag Picker Modal - multi-select filter */}
      <TagPicker
        visible={showTagPicker}
        tags={availableTags}
        selectedTags={selectedTags}
        onSelect={setSelectedTags}
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
}));
