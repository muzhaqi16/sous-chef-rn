import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useFragment } from '@apollo/client/react';
import { StyleSheet } from 'react-native-unistyles';
import { Header } from '#components/molecules/Header';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { TagPicker } from '#components/molecules/TagPicker';
import { EmptyState } from '#components/base/EmptyState';
import { SavedRecipeCard } from '#features/recipes/components/SavedRecipeCard';
import { SavedRecipeCard_SavedRecipeFragmentDoc } from '#features/recipes/components/SavedRecipeCard.generated';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  useSavedRecipes,
  type SavedRecipeNode,
} from '#features/recipes/hooks/useSavedRecipes';
import { useRecipeFolders } from '#features/recipes/hooks/useRecipeFolders';
import { useRecipeTags } from '#features/recipes/hooks/useRecipeTags';
import { useFolderActions } from '#features/recipes/hooks/useFolderActions';
import { useMutation } from '@apollo/client/react';
import {
  UnfavoriteRecipeDocument,
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { alertService } from '#/services/alertService';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';

const keyExtractor = (item: SavedRecipeNode) => item.id;

/**
 * Inline cell adapter — calls `useFragment` to read `name`/`description` for
 * search filtering, then delegates rendering to `<SavedRecipeCard>` which
 * subscribes via its own `useFragment`.
 */
const SavedRecipeRow: React.FC<{
  savedRecipe: SavedRecipeNode;
  searchQuery: string;
  onPress: (recipeId: string) => void;
  onRemove: (recipeId: string) => void;
}> = ({ savedRecipe, searchQuery, onPress, onRemove }) => {
  const { data, complete } = useFragment({
    fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeCard_savedRecipe',
    from: savedRecipe,
  });

  if (!complete) return null;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    const name = (data.recipe.name ?? '').toLowerCase();
    const description = (data.recipe.description ?? '').toLowerCase();
    if (!name.includes(q) && !description.includes(q)) return null;
  }

  return (
    <SavedRecipeCard
      savedRecipeRef={savedRecipe}
      onPress={onPress}
      onRemove={onRemove}
    />
  );
};

export const SavedRecipes: React.FC = () => {
  useScreenTransition('SavedRecipes');
  const { t } = useTranslation();
  const { toRecipeDetail, goBack } = useAppNavigation();

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
  const [unfavoriteRecipeMutation] = useMutation(UnfavoriteRecipeDocument, {
    update: (cache, { data }, { variables }) => {
      if (
        data?.unfavoriteRecipe?.__typename !== 'UnfavoriteRecipePayload' ||
        !variables?.input?.recipeId
      ) {
        return;
      }

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
                  edge => edge.node.recipe.id !== variables.input.recipeId,
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
        variables.input.recipeId,
        'isFavorited',
        false,
      );
    },
  });

  // Filter recipes by folder + tags (search query filtering happens per-row).
  const filteredRecipes = (() => {
    let result = recipes;

    if (selectedFolder) {
      result = result.filter(recipe => recipe.folder === selectedFolder);
    }

    if (selectedTags.length > 0) {
      result = result.filter(recipe => {
        const recipeTags = recipe.tags ?? [];
        return selectedTags.some(tag => recipeTags.includes(tag));
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

  const handleRefresh = async () => {
    await refetch();
  };

  const handleRemoveRecipe = async (recipeId: string) => {
    await executeMutation(
      () => unfavoriteRecipeMutation({ variables: { input: { recipeId } } }),
      (error: unknown) => {
        errorService.reportError(error, { operation: 'removeSavedRecipe' });
        alertService.alert(t('labels.error'), t('recipes.removeRecipeFailed'));
      },
    );
    optimisticDataPersistence.clear('SavedRecipe', recipeId, 'isFavorited');
  };

  const handleItemPress = (recipeId: string) => {
    toRecipeDetail({ recipeId });
  };

  // Check if any filters are active
  const hasActiveFilters = selectedFolder !== null || selectedTags.length > 0;

  // Define filter tabs with modal triggers
  const filterTabs = (() => {
    const tabs: FilterTabConfig<string>[] = [
      {
        id: 'all',
        label: t('recipes.filterAll'),
      },
    ];

    if (folders.length > 0) {
      tabs.push({
        id: 'folder',
        label: selectedFolder || t('recipes.folders'),
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
            ? t('recipes.tagCount', { count: selectedTags.length })
            : t('recipes.tags'),
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

  const renderItem = ({ item }: { item: SavedRecipeNode }) => (
    <SavedRecipeRow
      savedRecipe={item}
      searchQuery={searchQuery}
      onPress={handleItemPress}
      onRemove={handleRemoveRecipe}
    />
  );

  return (
    <View style={styles.container}>
      <Header title={t('recipes.savedRecipesTitle')} onBack={goBack} />
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('recipes.savedRecipesSearchPlaceholder')}
          showSearchIcon
        />
      </View>
      {FilterHeader}
      {filteredRecipes.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title={t('recipes.savedRecipesEmptyTitle')}
          description={t('recipes.savedRecipesEmptyDescription')}
        />
      ) : (
        <FlashList
          data={filteredRecipes}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onRefresh={handleRefresh}
          refreshing={false}
          contentContainerStyle={styles.listContent}
          {...FLASHLIST_DEFAULTS.fullScreen}
        />
      )}

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
  listContent: {
    paddingTop: theme.spacing['2.5'],
  },
}));
