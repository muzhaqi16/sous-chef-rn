import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Header } from '#components/molecules/Header';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { TagPicker } from '#components/molecules/TagPicker';
import { ItemList } from '#components/organisms/ItemList';
import { CachedImage } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useSavedRecipes } from '#/hooks/recipe/useSavedRecipes';
import { useRecipeFolders } from '#/hooks/recipe/useRecipeFolders';
import { useRecipeTags } from '#/hooks/recipe/useRecipeTags';
import { useFolderActions } from '#/hooks/recipe/useFolderActions';
import {
  useUnfavoriteRecipeMutation,
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { alertService } from '#/services/alertService';
import type { IconName } from '#/utils/iconUtils';

export const SavedRecipes: React.FC = () => {
  useScreenTransition('SavedRecipes');
  const { navigate, goBack } = useAppNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Fetch saved recipes, folders, and tags
  const {
    state: { recipes },
    actions: { refetch },
  } = useSavedRecipes();

  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();
  const {
    renameFolder,
    deleteFolder,
    loading: folderActionLoading,
  } = useFolderActions();

  // Unfavorite (remove from saved) recipe mutation
  const [unfavoriteRecipeMutation] = useUnfavoriteRecipeMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.unfavoriteRecipe?.success || !variables?.recipeId) return;

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
                totalCount:
                  (existing.me.savedRecipesConnection.totalCount ?? 0) - 1,
              },
            },
          };
        },
      );

      optimisticDataPersistence.save(
        'SavedRecipe',
        variables.recipeId,
        'isFavorited',
        false,
      );
    },
  });

  // Filter recipes based on search query, folder, and tags
  const filteredRecipes = (() => {
    let result = recipes;

    if (selectedFolder) {
      result = result.filter(recipe => recipe.folder === selectedFolder);
    }

    if (selectedTags.length > 0) {
      result = result.filter(recipe => {
        const recipeTags = recipe.tags || [];
        return selectedTags.some(tag => recipeTags.includes(tag));
      });
    }

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

  // Transform filtered recipes to list items format
  const items = filteredRecipes.map((recipe: any) => {
    const name = recipe.name || recipe.title;
    const imageUrl = recipe.imageUrl || recipe.image;
    const servings = recipe.servings;

    const totalTime =
      recipe.totalTimeMinutes ||
      recipe.readyInMinutes ||
      (recipe.prepTimeMinutes && recipe.cookTimeMinutes
        ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
        : recipe.prepTimeMinutes || recipe.cookTimeMinutes || null);

    return {
      id: String(recipe.recipeId),
      title: name,
      subtitle: `${servings} servings${totalTime ? ` • ${totalTime} min` : ''}`,
      leftElement: imageUrl ? (
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage
            uri={imageUrl}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      ) : undefined,
    };
  });

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedFolder(null);
    setSelectedTags([]);
    setSearchQuery('');
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    await executeMutation(
      () => unfavoriteRecipeMutation({ variables: { recipeId } }),
      (error: unknown) => {
        console.error('Failed to remove recipe:', error);
        alertService.alert(
          'Error',
          'Failed to remove recipe. Please try again.',
        );
      },
    );
    optimisticDataPersistence.clear('SavedRecipe', recipeId, 'isFavorited');
  };

  const handleItemPress = (id: string | number) => {
    navigate('RecipeDetail', { recipeId: String(id) });
  };

  // Check if any filters are active
  const hasActiveFilters = selectedFolder !== null || selectedTags.length > 0;

  // Define filter tabs with modal triggers
  const filterTabs = (() => {
    const tabs: FilterTabConfig<string>[] = [
      {
        id: 'all',
        label: 'All',
      },
    ];

    if (folders.length > 0) {
      tabs.push({
        id: 'folder',
        label: selectedFolder || 'Folders',
        icon: 'folder',
        onPress: () => setShowFolderPicker(true),
        showDropdownIndicator: true,
      });
    }

    if (availableTags.length > 0) {
      tabs.push({
        id: 'tags',
        label:
          selectedTags.length > 0
            ? `${selectedTags.length} Tag${selectedTags.length > 1 ? 's' : ''}`
            : 'Tags',
        icon: 'pricetag-outline',
        onPress: () => setShowTagPicker(true),
        showDropdownIndicator: true,
      });
    }

    return tabs;
  })();

  const filterCounts = {
    all: recipes.length,
    folder: folders.length,
    tags: availableTags.length,
  };

  const filteredTabs = (() => {
    const filtered: string[] = [];
    if (selectedFolder) filtered.push('folder');
    if (selectedTags.length > 0) filtered.push('tags');
    return filtered;
  })();

  const activeFilterTab = filteredTabs.length === 0 ? 'all' : '';

  const emptyStateConfig: {
    icon: IconName;
    title: string;
    description: string;
  } = {
    icon: 'bookmark-outline',
    title: 'No saved recipes',
    description: 'Save recipes from search to see them here',
  };

  // Filter header - shown when folders or tags are available
  const FilterHeader = (() => {
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
          testID: 'saved-recipes-clear-filters',
          disabled: !hasActiveFilters,
        }}
        testIDPrefix="saved-recipes-filter-tab"
      />
    );
  })();

  return (
    <View style={styles.container}>
      <Header title="Saved Recipes" onBack={goBack} />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search saved recipes..."
          showSearchIcon
        />
      </View>
      {FilterHeader}
      <ItemList
        items={items}
        onItemPress={handleItemPress}
        onItemDelete={handleRemoveRecipe}
        onRefresh={handleRefresh}
        emptyState={emptyStateConfig}
      />

      {/* Folder Picker Modal */}
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

      {/* Tag Picker Modal */}
      <TagPicker
        visible={showTagPicker}
        tags={availableTags}
        selectedTags={selectedTags}
        onSelect={setSelectedTags}
        onCancel={() => setShowTagPicker(false)}
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
