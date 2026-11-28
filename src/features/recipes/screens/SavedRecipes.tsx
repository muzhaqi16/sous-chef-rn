import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { SearchBar } from '#components/molecules/SearchBar';
import { kitTestIDs } from '#components/testIDs';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import { FolderPicker } from '#features/recipes/components/FolderPicker';
import { TagPicker } from '#features/recipes/components/TagPicker';
import { DataStateView } from '#components/organisms/DataStateView';
import { Loading } from '#components/molecules/Loading';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { useDataState } from '#hooks/data/useDataState';
import { SavedRecipeCard } from '#features/recipes/components/SavedRecipeCard';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  useSavedRecipes,
  type SavedRecipeNode,
} from '#features/recipes/screens/useSavedRecipes';
import { filterByTerm } from '#hooks/search/useLocalSearch';
import { useRecipeFolders } from '#features/recipes/hooks/useRecipeFolders';
import { useRecipeTags } from '#features/recipes/screens/useRecipeTags';
import { useFolderActions } from '#features/recipes/hooks/useFolderActions';
import { PROTECTED_RECIPE_FOLDERS } from '#features/recipes/utils/folders';
import { useUnfavoriteRecipe } from '#features/recipes/hooks/useUnfavoriteRecipe';
import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { SubScreen } from '#components/templates/SubScreen';
import { useScreenListInset } from '#components/templates/useScreenListInset';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { executeRefreshWithFinally } from '#utils/finallyHelpers';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { SearchIncompleteNotice } from '#features/recipes/components/SearchIncompleteNotice';

const keyExtractor = (item: SavedRecipeNode) => item.id;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

export const SavedRecipes: React.FC = () => {
  useScreenTransition('SavedRecipes');
  const { t } = useTranslation();
  const { toRecipeDetail } = useAppNavigation();
  const listInset = useScreenListInset();
  const { unfavoriteRecipe } = useUnfavoriteRecipe();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Folder, tags and search filter on the device, so any of them needs every
  // page; so does the open tag picker, whose tags derive from the loaded rows.
  const needsAllPages =
    searchQuery.trim().length > 0 ||
    selectedFolder !== null ||
    selectedTags.length > 0 ||
    showTagPicker;
  const {
    state: {
      recipes,
      loading,
      error,
      hasResult,
      skipped,
      hasMore,
      isLoadingMore,
      isLoadingRemainingPages,
      isSearchIncomplete,
    },
    actions: { refetch, loadMore, retryRemainingPages },
  } = useSavedRecipes({
    loadAllPages: needsAllPages,
    filterKey: JSON.stringify([
      searchQuery.trim(),
      selectedFolder,
      selectedTags,
    ]),
  });

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

  const {
    folders,
    unavailable: foldersUnavailable,
    refetch: refetchFolders,
  } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();
  // An unloaded page may hold the only tagged recipe, so the tab stays offered
  // until every page is in.
  const offersTagFilter = availableTags.length > 0 || hasMore;
  const {
    renameFolder,
    deleteFolder,
    loading: folderActionLoading,
  } = useFolderActions();

  // Folder, tags AND search filter here, never in the cell: a cell returning
  // null keeps its layout slot and fragment subscription. The query's node
  // selects `name` and `description` for this.
  const filteredRecipes = (() => {
    let result = recipes;

    if (selectedFolder) {
      result = result.filter(recipe => recipe.folder === selectedFolder);
    }

    if (selectedTags.length > 0) {
      result = result.filter(recipe => {
        return selectedTags.some(tag => recipe.tags.includes(tag));
      });
    }

    return filterByTerm(result, searchQuery, [
      saved => saved.recipe?.name,
      saved => saved.recipe?.description,
    ]);
  })();

  // Folder, tags or search can empty this list over a full library, where "you
  // haven't saved any recipes" would be false; `isEmpty` reads the UNFILTERED
  // list.
  const savedSearchTerm = searchQuery.trim();
  const emptyProps = isSearchIncomplete
    ? {
        icon: 'warning-outline',
        title: t('recipes.searchIncompleteTitle'),
        description: t('recipes.searchIncompleteDescription'),
        action: { label: t('labels.retry'), onPress: retryRemainingPages },
      }
    : recipes.length > 0
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
    rowCount: filteredRecipes.length,
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

  const [refreshing, setRefreshing] = useState(false);
  // Folder names derive from the saved rows, so a refresh re-reads both.
  const handleRefresh = () =>
    executeRefreshWithFinally(
      () => Promise.all([refetch(), refetchFolders()]),
      setRefreshing,
    );

  const handleRemoveRecipe = async (recipeId: string) => {
    await unfavoriteRecipe(recipeId);
  };

  const handleEndReached = () => {
    if (hasMore) {
      void loadMore();
    }
  };

  const handleItemPress = (recipeId: string) => {
    toRecipeDetail({ recipeId });
  };

  type FilterChip = 'all' | 'folder' | 'tags';
  const testIDOf = (key: FilterChip) =>
    kitTestIDs.filterTab(recipesTestIDs.savedRecipesFilterTabPrefix, key);

  // All clears every filter; a folder or tag chip opens its picker, and shows
  // as selected while it filters.
  const filterOptions: ChipOption<FilterChip>[] = [
    {
      key: 'all',
      label: t('labels.all'),
      count: recipes.length,
      testID: testIDOf('all'),
    },
  ];
  if (folders.length > 0 || foldersUnavailable) {
    filterOptions.push({
      key: 'folder',
      label: selectedFolder ?? t('recipes.folders'),
      icon: 'folder',
      // Unread offline: no count, which would say none.
      ...(foldersUnavailable ? undefined : { count: folders.length }),
      testID: testIDOf('folder'),
    });
  }
  if (offersTagFilter) {
    filterOptions.push({
      key: 'tags',
      label:
        selectedTags.length > 0
          ? t('recipes.tagCount', { count: selectedTags.length })
          : t('labels.tags'),
      icon: 'pricetag-outline',
      ...(hasMore ? undefined : { count: availableTags.length }),
      testID: testIDOf('tags'),
    });
  }

  const selectedFilters: FilterChip[] = [];
  if (selectedFolder) selectedFilters.push('folder');
  if (selectedTags.length > 0) selectedFilters.push('tags');

  const handleFilterPress = (key: FilterChip) => {
    if (key === 'folder') setShowFolderPicker(true);
    else if (key === 'tags') setShowTagPicker(true);
    else handleClearFilters();
  };

  // Shown when folders or tags are available.
  const FilterHeader =
    filterOptions.length > 1 ? (
      <ChipScrollRow<FilterChip>
        options={filterOptions}
        selected={selectedFilters.length > 0 ? selectedFilters : 'all'}
        onSelect={handleFilterPress}
        edgeFadeColor="background"
      />
    ) : null;

  const renderItem = ({ item }: { item: SavedRecipeNode }) => (
    <SavedRecipeCard
      savedRecipeRef={item}
      onPress={handleItemPress}
      onRemove={handleRemoveRecipe}
    />
  );

  return (
    <SubScreen
      title={t('recipes.savedRecipesTitle')}
      scroll="list"
      gutter="none"
    >
      <View style={styles.searchBarContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('recipes.savedRecipesSearchPlaceholder')}
        />
      </View>
      <View style={styles.gutter}>{FilterHeader}</View>
      {dataState === 'ready' &&
      filteredRecipes.length === 0 &&
      isLoadingRemainingPages ? (
        <Loading size="small" message={t('recipes.savedRecipesSearchingAll')} />
      ) : dataState !== 'ready' || filteredRecipes.length === 0 ? (
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
          refreshControl={
            <PlainScrollRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          onEndReached={handleEndReached}
          ListHeaderComponent={
            isSearchIncomplete ? (
              <SearchIncompleteNotice onRetry={retryRemainingPages} />
            ) : null
          }
          ListFooterComponent={
            isLoadingRemainingPages ? (
              <Loading
                size="small"
                message={t('recipes.savedRecipesSearchingAll')}
                style={styles.loadingRemaining}
              />
            ) : (
              <PaginationFooter
                hasMore={hasMore}
                isFetchingMore={isLoadingMore}
                itemCount={filteredRecipes.length}
              />
            )
          }
          contentContainerStyle={[styles.listContent, listInset]}
          {...FLASHLIST_DEFAULTS.fullScreen}
        />
      )}

      {/* Folder Picker Modal */}
      <FolderPicker
        visible={showFolderPicker}
        folders={folders}
        unavailable={foldersUnavailable}
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
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        // The filter follows a folder renamed or deleted, picker left open.
        onSelectedFolderMoved={setSelectedFolder}
        folderActionLoading={folderActionLoading}
      />

      {/* Tag Picker Modal */}
      <TagPicker
        visible={showTagPicker}
        tags={availableTags}
        selectedTags={selectedTags}
        onSelect={setSelectedTags}
        onCancel={() => setShowTagPicker(false)}
        loading={isLoadingRemainingPages}
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  // The screen is `gutter="none"` and the list content container carries the
  // inset for the rows; the filter strip renders outside it and takes its own.
  gutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  loadingRemaining: {
    flex: 0,
  },
  listContent: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.smPlus,
  },
}));
