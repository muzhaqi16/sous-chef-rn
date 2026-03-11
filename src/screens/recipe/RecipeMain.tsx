import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Text, Pressable } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ItemList } from '#components/organisms/ItemList';
import { SearchBar } from '#components/molecules/SearchBar';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { TagPicker } from '#components/molecules/TagPicker';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import {
  useUnfavoriteRecipeMutation,
  useDeleteRecipeMutation,
  MySavedRecipesDocument,
  MyRecipesDocument,
  type MySavedRecipesQuery,
  type MyRecipesQuery } from '#generated';
import { useSavedRecipes } from '#/hooks/recipe/useSavedRecipes';
import { useRecipeManagement } from '#/hooks/recipe/useRecipeManagement';
import { useRecipeFolders } from '#/hooks/recipe/useRecipeFolders';
import { useRecipeTags } from '#/hooks/recipe/useRecipeTags';
import { useFolderActions } from '#/hooks/recipe/useFolderActions';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { Icon } from '#/utils/iconUtils';
import { useTabScreenLifecycle } from '#hooks/performance/useTabScreenLifecycle';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { DeferredScreen } from '#components/performance/DeferredScreen';
import { RecipeSkeleton } from '#components/base/Skeleton/RecipeSkeleton';
import { CachedImage } from '#components/atoms/CachedImage';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

const viewOptions = ['saved', 'myRecipes'] as const;

/** Module-level helper to clear random recipes when user has saved recipes */
function clearRandomRecipesIfNeeded(
  savedCount: number,
  randomCount: number,
  setRandomRecipes: (v: RecipeInformation[]) => void,
  hasFetchedRandom: React.RefObject<boolean>,
) {
  if (savedCount > 0 && randomCount > 0) {
    setRandomRecipes([]);
    hasFetchedRandom.current = false;
  }
}

/**
 * Inner component that runs all heavy hooks.
 * Only mounts after isReady is true, so the skeleton paints instantly.
 */
const RecipeMainInner: React.FC = () => {
  useRenderTime('RecipeMain');
  const { navigate } = useAppNavigation();
  const { theme } = useUnistyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'saved' | 'myRecipes'>('saved');

  // Filter state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Fetch folders and tags for filtering
  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();

  // Folder management actions
  const {
    renameFolder,
    deleteFolder,
    loading: folderActionLoading } = useFolderActions();

  // State for random recipes (shown when user has no saved recipes)
  const [randomRecipes, setRandomRecipes] = useState<RecipeInformation[]>([]);
  const [loadingRandom, setLoadingRandom] = useState(false);

  // Ref to track if we've already fetched random recipes (prevents infinite loop)
  const hasFetchedRandom = useRef(false);

  // Fetch user's saved/favorited recipes from backend
  const { state: { recipes, loading }, actions: { refetch } } = useSavedRecipes();

  // Lifecycle: optimistic restoration, cache persistence, perf tracking
  useTabScreenLifecycle({
    screenName: 'RecipeMain',
    optimisticTypes: ['Recipe', 'SavedRecipe'],
    telemetryProperties: () => ({
      recipe_count: recipes.length,
      view: activeView,
    }),
  });

  // Fetch user-created recipes
  const {
    state: { recipes: myRecipes },
    actions: { refetch: myRecipesRefetch },
  } = useRecipeManagement();

  // Fetch random recipes ONLY ONCE when user has no saved recipes
  useEffect(() => {
    const controller = new AbortController();

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
      return () => controller.abort();
    }

    hasFetchedRandom.current = true;
    executeWithLoadingState(
      async () => {
        const random = await spoonacularService.getRandomRecipes({
          number: 10 }, controller.signal);
        setRandomRecipes(random);
      },
      setLoadingRandom,
      (error: unknown) => {
        if ((error as any).name === 'AbortError') return;
        console.error('Failed to fetch random recipes:', error);
        // Reset flag so user can retry
        hasFetchedRandom.current = false;
      },
    );

    return () => controller.abort();
  }, [recipes.length, loading, loadingRandom]);

  // Clear random recipes when user saves their first recipe
  useEffect(() => {
    clearRandomRecipesIfNeeded(recipes.length, randomRecipes.length, setRandomRecipes, hasFetchedRandom);
  }, [recipes.length, randomRecipes.length]);

  // Register add button action - navigate to recipe creation
  useTabBarAddButton(() => navigate('RecipeCreate'));

  // Manual refresh to get new random recipes
  const handleRefreshRandom = () => {
    if (loadingRandom) return;

    executeWithLoadingState(
      async () => {
        const random = await spoonacularService.getRandomRecipes({ number: 10 });
        setRandomRecipes(random);
      },
      setLoadingRandom,
      (error) => {
        console.error('Failed to fetch random recipes:', error);
        Alert.alert(
          'Error',
          'Failed to load recipe suggestions. Please try again.',
        );
      },
    );
  };

  // Determine if we should show random recipes
  const showRandomRecipes = activeView === 'saved' && recipes.length === 0 && randomRecipes.length > 0;

  // Filter recipes based on search query, folder, and tags
  const filteredRecipes = (() => {
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
  })();

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedFolder(null);
    setSelectedTags([]);
    setSearchQuery('');
  };

  // Unfavorite (remove from saved) recipe mutation
  const [unfavoriteRecipeMutation] = useUnfavoriteRecipeMutation({
    // Use cache updates instead of refetchQueries for better performance and offline support
    update: (cache, { data }, { variables }) => {
      if (!data?.unfavoriteRecipe?.success || !variables?.recipeId) return;

      // Remove from mySavedRecipes connection
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing?.me) return existing;
          return {
            ...existing,
            me: {
              ...existing.me,
              savedRecipesConnection: {
                ...existing.me.savedRecipesConnection,
                edges: existing.me.savedRecipesConnection.edges.filter(
                  edge => edge.node.recipe.id !== variables.recipeId,
                ),
                totalCount: (existing.me.savedRecipesConnection.totalCount ?? 0) - 1 } } };
        },
      );

      // Persist optimistic unfavorite state to survive cache-and-network refetches while offline
      optimisticDataPersistence.save('SavedRecipe', variables.recipeId, 'isFavorited', false);
    } });

  // Delete recipe mutation (for user-created recipes)
  const [deleteRecipeMutation] = useDeleteRecipeMutation({
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

  // Filter myRecipes by search query
  const filteredMyRecipes = (() => {
    if (activeView !== 'myRecipes') return [];
    if (!searchQuery.trim()) return myRecipes;
    const query = searchQuery.toLowerCase();
    return myRecipes.filter((recipe: any) => {
      const name = recipe.name?.toLowerCase() || '';
      const description = recipe.description?.toLowerCase() || '';
      return name.includes(query) || description.includes(query);
    });
  })();

  // Transform filtered recipes to list items format (handles saved, random, and my recipes)
  const items = (() => {
    if (activeView === 'myRecipes') {
      return filteredMyRecipes.map((recipe: any) => {
        const totalTime =
          recipe.totalTimeMinutes ||
          (recipe.prepTimeMinutes && recipe.cookTimeMinutes
            ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
            : recipe.prepTimeMinutes || recipe.cookTimeMinutes || null);

        return {
          id: String(recipe.id),
          title: recipe.name,
          subtitle: `${recipe.servings} servings${
            totalTime ? ` • ${totalTime} min` : ''
          }`,
          leftElement: recipe.imageUrl ? (
            <View style={commonStyles.listItemImageContainerCompact}>
              <CachedImage uri={recipe.imageUrl} style={commonStyles.listItemImageCompact} displaySize={48} />
            </View>
          ) : undefined,
        };
      });
    }

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
          <View style={commonStyles.listItemImageContainerCompact}>
            <CachedImage uri={imageUrl} style={commonStyles.listItemImageCompact} displaySize={48} />
          </View>
        ) : undefined };
    });
  })();

  const handleSearchRecipes = () => {
    navigate('RecipeSearch', { initialQuery: searchQuery });
  };

  const handleRefresh = async () => {
    if (activeView === 'myRecipes') {
      await myRecipesRefetch();
    } else if (showRandomRecipes) {
      await handleRefreshRandom();
    } else {
      await refetch();
    }
  };

  const handleRemoveRecipe = async (recipeId: string) => {
      try {
        await unfavoriteRecipeMutation({
          variables: { recipeId } });
        // Clear persisted optimistic favorite state on server confirmation
        optimisticDataPersistence.clear('SavedRecipe', recipeId, 'isFavorited');
      } catch (error) {
        console.error('Failed to remove recipe:', error);
        Alert.alert('Error', 'Failed to remove recipe. Please try again.');
      }
    };

  const handleDeleteMyRecipe = async (id: string) => {
    try {
      await deleteRecipeMutation({ variables: { id } });
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      Alert.alert('Error', 'Failed to delete recipe. Please try again.');
    }
  };

  // Header right action - navigate to recipe search
  const headerRight = (
      <Pressable
        onPress={handleSearchRecipes}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Search recipes"
      >
        <Icon
          name="search-outline"
          size={24}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    );

  const emptyStateConfig = activeView === 'myRecipes'
    ? {
        icon: 'create-outline' as const,
        title: 'No recipes yet',
        description: 'Create your first recipe',
        action: {
          label: 'Create Recipe',
          onPress: () => navigate('RecipeCreate'),
        },
      }
    : {
        icon: 'book' as const,
        title: 'No saved recipes',
        description: 'Search for recipes and save your favorites',
        action: {
          label: 'Search Recipes',
          onPress: handleSearchRecipes,
        },
      };

  // Handle item press - navigate differently for saved vs random vs my recipes
  const handleItemPress = (id: string | number) => {
      if (activeView === 'myRecipes') {
        navigate('RecipeDetail', { recipeId: String(id) });
      } else if (showRandomRecipes) {
        // Random recipe from Spoonacular - navigate with external source params
        navigate('RecipeDetail', {
          externalSource: 'SPOONACULAR',
          externalId: String(id) });
      } else {
        // Saved recipe - navigate with recipeId
        navigate('RecipeDetail', { recipeId: String(id) });
      }
    };

  // Suggested Recipes Header Component - shown when displaying random recipes
  const SuggestedHeader = (() => {
    if (!showRandomRecipes) return null;
    return (
      <View style={styles.suggestedHeader}>
        <View style={styles.suggestedTextContainer}>
          <Text style={styles.suggestedTitle}>Need inspiration?</Text>
          <Text style={styles.suggestedSubtitle}>
            Here are some recipe ideas to try
          </Text>
        </View>
        <Pressable
          style={({pressed}) => [styles.refreshButton, pressed && styles.pressed]}
          onPress={handleRefreshRandom}
          disabled={loadingRandom}
          accessibilityRole="button"
          accessibilityLabel="Refresh recipe suggestions"
        >
          <Icon
            name="refresh"
            size={20}
            color={
              loadingRandom ? theme.colors.textSecondary : theme.colors.primary
            }

          />
        </Pressable>
      </View>
    );
  })();

  const formatViewLabel = (value: 'saved' | 'myRecipes') =>
    value === 'saved' ? 'Saved' : 'My Recipes';

  const handleEditRecipe = (id: string) => {
    navigate('RecipeEdit', { recipeId: id });
  };

  // Determine the delete handler based on active view
  const handleItemDelete = (() => {
    if (activeView === 'myRecipes') return handleDeleteMyRecipe;
    if (showRandomRecipes) return undefined;
    return handleRemoveRecipe;
  })();

  // Check if any filters are active
  const hasActiveFilters = selectedFolder !== null || selectedTags.length > 0;

  // Define filter tabs with modal triggers
  const filterTabs = (() => {
    const tabs: FilterTabConfig<string>[] = [
      {
        id: 'all',
        label: 'All' },
    ];

    // Add folder pill if folders exist
    if (folders.length > 0) {
      tabs.push({
        id: 'folder',
        label: selectedFolder || 'Folders',
        icon: 'folder',
        onPress: () => setShowFolderPicker(true),
        showDropdownIndicator: true });
    }

    // Add tags pill if tags exist
    if (availableTags.length > 0) {
      tabs.push({
        id: 'tags',
        label:
          selectedTags.length > 0
            ? `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}`
            : 'Tags',
        icon: 'pricetag-outline',
        onPress: () => setShowTagPicker(true),
        showDropdownIndicator: true });
    }

    return tabs;
  })();

  // Calculate counts for filter tabs
  const filterCounts = ({
      all: recipes.length,
      folder: folders.length,
      tags: availableTags.length });

  // Compute which tabs have active filters (shown with subtle filtered styling)
  const filteredTabs = (() => {
    const filtered: string[] = [];
    if (selectedFolder) filtered.push('folder');
    if (selectedTags.length > 0) filtered.push('tags');
    return filtered;
  })();

  // "All" is only active when no filters are applied; otherwise no tab is active
  const activeFilterTab = filteredTabs.length === 0 ? 'all' : '';

  // Filter Header Component - shown when user has saved recipes
  const FilterHeader = (() => {
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
          icon: 'close',
          onPress: handleClearFilters,
          testID: 'recipe-clear-filters',
          disabled: !hasActiveFilters }}
        testIDPrefix="recipe-filter-tab"
      />
    );
  })();

  return (
    <View style={styles.container} testID="recipes-screen">
      <TabScreenHeader
        label="What to cook?"
        title="Recipes"
        headerRight={headerRight}
      />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search recipes..."
          showSearchIcon
        />
      </View>
      <View style={styles.segmentContainer}>
        <SegmentedControl
          options={viewOptions}
          value={activeView}
          onChange={setActiveView}
          formatLabel={formatViewLabel}
          size="compact"
          testID="recipe-view-toggle"
        />
      </View>
      {activeView === 'saved' && FilterHeader}
      <ItemList
        items={items}
        onItemPress={handleItemPress}
        onItemDelete={handleItemDelete}
        onItemEdit={activeView === 'myRecipes' ? handleEditRecipe : undefined}
        onRefresh={handleRefresh}
        emptyState={emptyStateConfig}
      />

      {/* Folder Picker Modal - filter only, no folder creation, with rename/delete */}
      {activeView === 'saved' && <FolderPicker
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
      />}

      {/* Tag Picker Modal - multi-select filter */}
      {activeView === 'saved' && <TagPicker
        visible={showTagPicker}
        tags={availableTags}
        selectedTags={selectedTags}
        onSelect={setSelectedTags}
        onCancel={() => setShowTagPicker(false)}
      />}
    </View>
  );
};

const noop = () => {};

/**
 * Outer component that gates heavy work behind DeferredScreen.
 * Skeleton paints instantly; RecipeMainInner mounts on the deferred re-render.
 */
export const RecipeMain: React.FC = () => (
  <DeferredScreen
    fallback={
      <View style={styles.container} testID="recipes-screen">
        <TabScreenHeader label="What to cook?" title="Recipes" />
        <View style={styles.searchBarContainer}>
          <SearchBar
            value=""
            onChangeText={noop}
            placeholder="Search recipes..."
            showSearchIcon
            editable={false}
          />
        </View>
        <View style={styles.segmentContainer}>
          <SegmentedControl
            options={viewOptions}
            value="saved"
            onChange={noop}
            formatLabel={(v: string) => v === 'saved' ? 'Saved' : 'My Recipes'}
            size="compact"
          />
        </View>
        <RecipeSkeleton />
      </View>
    }
    component={RecipeMainInner}
  />
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md },
  segmentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.md },
  suggestedTextContainer: {
    flex: 1 },
  suggestedTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary },
  suggestedSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2 },
  refreshButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background },
  pressed: {
    opacity: theme.opacity.pressed } }));
