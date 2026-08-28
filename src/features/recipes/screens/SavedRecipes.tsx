import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { Header } from '#components/molecules/Header';
import { SearchBar } from '#components/molecules/SearchBar';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { FolderPicker } from '#components/molecules/FolderPicker';
import { TagPicker } from '#components/molecules/TagPicker';
import { DataStateView } from '#components/molecules/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { SavedRecipeCard } from '#features/recipes/components/SavedRecipeCard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  useSavedRecipes,
  type SavedRecipeNode,
} from '#features/recipes/hooks/useSavedRecipes';
import { useRecipeFolders } from '#features/recipes/hooks/useRecipeFolders';
import { useRecipeTags } from '#features/recipes/hooks/useRecipeTags';
import { useFolderActions } from '#features/recipes/hooks/useFolderActions';
import { PROTECTED_RECIPE_FOLDERS } from '#features/recipes/utils/folders';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveRecipeFromFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import { performOptimisticUnfavorite } from '#features/recipes/utils/optimisticUnfavorite';
import { alertService } from '#/services/alertService';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';

const keyExtractor = (item: SavedRecipeNode) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

export const SavedRecipes: React.FC = () => {
  useScreenTransition('SavedRecipes');
  const { t } = useTranslation();
  const { toRecipeDetail, goBack } = useAppNavigation();
  const client = useApolloClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Fetch saved recipes, folders, and tags
  const {
    state: { recipes, loading, error, hasResult, skipped },
    actions: { refetch },
  } = useSavedRecipes();

  // Classified on the fetched set, not the filtered one: a search that matches
  // nothing is a different situation from a fetch that returned nothing, and
  // neither is a failed request.
  const dataState = useDataState({
    loading,
    error,
    hasResult,
    skipped,
    isEmpty: recipes.length === 0,
  });

  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();
  const {
    renameFolder,
    deleteFolder,
    loading: folderActionLoading,
  } = useFolderActions();

  // Unfavorite (remove from saved) recipe mutation. The cache work (drop the
  // MySavedRecipes edge + clear Recipe.savedDetails) runs optimistically BEFORE
  // the mutation fires in handleRemoveRecipe, so the removal sticks even fully
  // offline (the queue replays the idempotent unfavorite). A rejected result
  // reverts from a snapshot — so no update callback here.
  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
  );

  // Folder, tags AND search all filter here, never inside the cell: a
  // virtualized list cannot absorb rows that return null — the cell, its
  // layout slot and its fragment subscription all survive. `recipe.name` and
  // `recipe.description` are selected on the query's node for exactly this
  // (see recipe.graphql).
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

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(saved => {
        const name = (saved.recipe.name ?? '').toLowerCase();
        const description = (saved.recipe.description ?? '').toLowerCase();
        return name.includes(q) || description.includes(q);
      });
    }

    return result;
  })();

  // Instrumented like PantryContent/SortableList so this list reports
  // `flashlist_initial_load_ms` and blank-cell episodes instead of being
  // invisible to every metric we have.
  // Folder, tags and search can all empty this list while the library itself is
  // full. Saying "you haven't saved any recipes" then would be false and would
  // hide that a filter is what emptied it — `isEmpty` above reads the
  // UNFILTERED list, so the two cases have to be told apart here.
  const savedSearchTerm = searchQuery.trim();
  const emptyProps =
    recipes.length > 0
      ? {
          icon: 'search-outline',
          title: savedSearchTerm
            ? t('empty.noResultsFor', { query: savedSearchTerm })
            : t('empty.noResults'),
        }
      : {
          icon: 'bookmark-outline',
          title: t('recipes.savedRecipesEmptyTitle'),
          description: t('recipes.savedRecipesEmptyDescription'),
        };

  const flashListRef = useRef<FlashListRef<SavedRecipeNode>>(null);
  const perfCallbacks = useFlashListPerformance(flashListRef, {
    componentName: 'SavedRecipes',
    hasRealContent: filteredRecipes.length > 0,
  });
  useDataReferenceTracker(
    filteredRecipes,
    'SavedRecipes.items',
    perfCallbacks.onDataReferenceChange,
  );

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
    await performOptimisticUnfavorite({
      client,
      recipeId,
      mutate: () =>
        unfavoriteRecipeMutation({
          variables: { input: { recipeId } },
          // Local-first: queue + replay (idempotent) when the API is
          // unreachable instead of surfacing a blocking error.
          context: { localFirst: true },
        }),
      operation: 'removeSavedRecipe',
      reportFailure: () =>
        alertService.alert(t('labels.error'), t('recipes.removeRecipeFailed')),
    });
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
    <SavedRecipeCard
      savedRecipeRef={item}
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
      {dataState !== 'ready' || filteredRecipes.length === 0 ? (
        <DataStateView
          state={dataState === 'ready' ? 'empty' : dataState}
          onRetry={handleRefresh}
          empty={emptyProps}
        />
      ) : (
        <FlashList
          ref={flashListRef}
          CellRendererComponent={perfCallbacks.CellRendererComponent}
          onLoad={perfCallbacks.onLoad}
          onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
          onCommitLayoutEffect={perfCallbacks.onCommitLayoutEffect}
          data={filteredRecipes}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
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
        // This is the picker that offers rename and delete, so it is the one
        // that must say what those actions may not touch.
        protectedFolders={PROTECTED_RECIPE_FOLDERS}
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
