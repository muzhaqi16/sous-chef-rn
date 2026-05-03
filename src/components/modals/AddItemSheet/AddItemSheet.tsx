import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ItemSuggestion } from '#generated';
import { ItemSuggestionsList } from '#components/molecules/ItemSuggestionsList';
import {
  BottomSheetSearchBar,
  type BottomSheetSearchBarRef,
} from '#components/molecules/BottomSheetSearchBar';
import { ActionCard } from '#components/molecules/ActionCard';
import { SuggestionListItem } from '#components/molecules/SuggestionListItem';
import { useItemAutocomplete } from '#hooks/autocomplete/useItemAutocomplete';
import type {
  AddItemSheetProps,
  BaseSuggestionItem,
  SuggestionGroupConfig,
} from './types';
import { useAddItemSheetState } from './useAddItemSheetState';
import { Text } from '#components/atoms/Text';

/**
 * Generic AddItemSheet component.
 *
 * A reusable bottom sheet for adding items with:
 * - Search with autocomplete
 * - Suggestion sections (configurable)
 * - Quick add functionality
 * - Barcode scanning
 * - Add manually option
 *
 * Used by both AddToPantrySheet and AddToShoppingListSheet.
 */
export function AddItemSheet({
  visible,
  contextId,
  onClose,
  config,
  suggestions,
  onQuickAddSearchSuggestion,
  onQuickAddSuggestion,
  isMutating,
  onAddManually,
  onScanPress,
  onIdentifyPress,
  exitingItems: externalExitingItems,
  onExitComplete,
  initialSearchQuery = '',
  showImages = true,
  tutorialHint,
  children,
}: AddItemSheetProps) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const searchBarRef = useRef<BottomSheetSearchBarRef>(null);

  // useStandardBottomSheet handles ref, modalProps (backdrop, animations,
  // insets, back handler), present/dismiss effect, and contentContainerStyle.
  // Visibility is auto-managed via the `visible && !!contextId` boolean.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible: visible && !!contextId,
    onDismiss: onClose,
    snapPoints: ['70%', '95%'],
    keyboardBehavior: 'extend',
  });

  // Shared state management
  const state = useAddItemSheetState({
    visible,
    contextId,
    deferFetch: config.deferFetch,
  });

  // Destructure for stable references in callbacks
  const { setSearchQuery } = state;

  // Use external exiting items if provided, otherwise use internal state
  const exitingItems = externalExitingItems ?? state.exitingItems;

  // Autocomplete search — debounceMs: 0 because BottomSheetSearchBar already debounces
  const autocomplete = useItemAutocomplete({ debounceMs: 0 });
  const { handleSearchTermChange, reset: resetAutocomplete } = autocomplete;

  // Determine when to show search results vs suggestions
  const hasSearchQuery = autocomplete.searchTerm.length >= 2;
  const hasSearchData =
    autocomplete.displayItems.length > 0 ||
    (hasSearchQuery && !autocomplete.isLoading);
  const showSearchResults = hasSearchQuery && hasSearchData;
  const showSuggestions = !showSearchResults;

  // Search handler - called after BottomSheetSearchBar debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    handleSearchTermChange(text);
  };

  // useStandardBottomSheet handles present/dismiss. Effect-driven side
  // tasks: clear the search bar when the sheet opens, reset autocomplete on
  // close. Effect runs after commit so ref access is safe.
  const isOpen = visible && !!contextId;
  useEffect(() => {
    if (isOpen) {
      searchBarRef.current?.clear();
    } else {
      resetAutocomplete();
    }
  }, [isOpen, resetAutocomplete]);

  // Wrap onAddManually to provide search value
  const handleAddManually = () => {
    const searchValue = searchBarRef.current?.getValue() || '';
    onAddManually(searchValue);
  };

  // Handle selecting a search suggestion
  const handleSelectSearchSuggestion = (item: ItemSuggestion) => {
    onQuickAddSearchSuggestion(item);
    // Clear search after adding
    searchBarRef.current?.clear();
    setSearchQuery('');
    resetAutocomplete();
  };

  // Stable theme colors reference for SuggestionListItem (avoids per-item useUnistyles)
  const themeColors = {
    primary: theme.colors.primary,
    textTertiary: theme.colors.textTertiary,
  };

  // Render a suggestion item with exit animation support
  const renderSuggestionItem = (item: BaseSuggestionItem) => {
    const itemId = item.itemId;
    const isExiting = exitingItems.has(itemId);

    return (
      <SuggestionListItem
        key={item.id}
        imageUrl={item.imageUrl}
        title={item.name}
        subtitle={item.category}
        placeholderIcon={config.placeholderIcon}
        onQuickAdd={() => onQuickAddSuggestion(item)}
        quickAddDisabled={isExiting}
        isExiting={isExiting}
        onExitComplete={
          onExitComplete ? () => onExitComplete(itemId) : undefined
        }
        themeColors={themeColors}
        showImage={showImages}
      />
    );
  };

  // Render a section of suggestions
  const renderSuggestionSection = (groupConfig: SuggestionGroupConfig) => {
    const items = groupConfig.accessor(suggestions.grouped);
    if (items.length === 0) return null;

    return (
      <View key={groupConfig.key} style={styles.suggestionSection}>
        <Text
          size="sm"
          weight="semibold"
          tone="secondary"
          style={styles.sectionTitle}
        >
          {groupConfig.title}
        </Text>
        <View style={styles.suggestionList}>
          {items.map(renderSuggestionItem)}
        </View>
      </View>
    );
  };

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        {...modalProps}
        // @ts-expect-error - BottomSheetModal doesn't officially support testID but it works
        testID={`${config.testIDPrefix}-modal`}
      >
        <View style={{ flex: 1 }} testID={`${config.testIDPrefix}-modal`}>
          <BottomSheetScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: insets.bottom + 16 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Text size="xl" weight="bold" style={styles.title}>
              {config.title}
            </Text>

            {/* Search Input */}
            <BottomSheetSearchBar
              ref={searchBarRef}
              placeholder={config.searchPlaceholder}
              onChangeText={handleSearchChange}
              onClear={() => setSearchQuery('')}
              initialValue={initialSearchQuery}
              isLoading={!!autocomplete.isLoading && hasSearchQuery}
              rightActions={[
                {
                  icon: 'barcode-outline',
                  onPress: onScanPress,
                },
              ]}
            />

            {/* Search Results */}
            {!!showSearchResults && (
              <ItemSuggestionsList
                searchQuery={state.searchQuery}
                suggestions={autocomplete.displayItems}
                loading={autocomplete.isLoading}
                addManuallyPosition={config.addManuallyPosition}
                onAddManually={handleAddManually}
                onSelectSuggestion={handleSelectSearchSuggestion}
                quickAddDisabled={isMutating}
                placeholderIcon={config.placeholderIcon}
                showBrands={false}
                showImages={showImages}
              />
            )}

            {/* Action Buttons - hidden when showing search results */}
            {!showSearchResults && (
              <View style={styles.actionButtons}>
                <ActionCard
                  icon="barcode-outline"
                  label="Scan Barcode"
                  onPress={onScanPress}
                />
                {!!onIdentifyPress && (
                  <ActionCard
                    icon="camera-outline"
                    label="Identify"
                    onPress={onIdentifyPress}
                    testID={`${config.testIDPrefix}-identify-button`}
                  />
                )}
                <ActionCard
                  icon="add"
                  label="Add Manually"
                  onPress={handleAddManually}
                  testID={`${config.testIDPrefix}-add-manually-button`}
                />
              </View>
            )}

            {/* Tutorial hint (e.g. "Tap + next to an item to add it") */}
            {!!tutorialHint && !showSearchResults && tutorialHint}

            {/* Suggestions Sections - shown when search is empty, deferred until after animation */}
            {!!showSuggestions && !!state.shouldRenderSuggestions && (
              <>
                {suggestions.loading && !suggestions.hasSuggestions ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                    />
                  </View>
                ) : !suggestions.hasSuggestions ? (
                  <View style={styles.emptyContainer}>
                    <Text
                      size="base"
                      weight="medium"
                      tone="secondary"
                      style={styles.emptyText}
                    >
                      {config.emptyStateMessage}
                    </Text>
                    <Text size="sm" tone="tertiary" align="center">
                      {config.emptyStateSubtext}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Render suggestion sections in priority order */}
                    {config.suggestionGroups
                      .sort((a, b) => a.priority - b.priority)
                      .map(renderSuggestionSection)}
                  </>
                )}
              </>
            )}
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>

      {/* Nested sheets (e.g., AddDetailsSheet for Pantry) */}
      {children}
    </>
  );
}

// Export ref getter function for wrapper components
export function useAddItemSheetRefs() {
  const searchBarRef = useRef<BottomSheetSearchBarRef>(null);

  const getSearchValue = () => {
    return searchBarRef.current?.getValue() || '';
  };

  const clearSearch = () => {
    searchBarRef.current?.clear();
  };

  return { searchBarRef, getSearchValue, clearSearch };
}

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    marginBottom: theme.spacing.xs,
  },
  suggestionSection: {
    marginBottom: theme.spacing.lg,
  },
  suggestionList: {
    gap: theme.spacing.xs,
  },
}));
