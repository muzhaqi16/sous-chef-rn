import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { ItemSuggestionsList } from '#components/molecules/ItemSuggestionsList';
import {
  BottomSheetSearchBar,
  type BottomSheetSearchBarRef,
} from '#components/molecules/BottomSheetSearchBar';
import { ActionCard } from '#components/molecules/ActionCard';
import { SuggestionListItem } from '#components/molecules/SuggestionListItem';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#utils/iconUtils';
import { useItemAutocomplete } from '#hooks/autocomplete/useItemAutocomplete';
import type {
  AddItemSheetProps,
  BaseSuggestionItem,
  SuggestionGroupConfig,
} from './types';
import { useAddItemSheetState } from './useAddItemSheetState';
import { SuggestionDrilldown } from './SuggestionDrilldown';
import { Text } from '#components/atoms/Text';

/**
 * How many rows each section shows in the overview before a "More" affordance
 * drills into that source's full list. Keeps any single source (e.g. a polluted
 * recently-deleted list) from taking over the sheet.
 */
const PREVIEW_COUNT = 5;

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
export function AddItemSheet<
  T extends BaseSuggestionItem = BaseSuggestionItem,
>({
  visible,
  contextId,
  onClose,
  config,
  suggestions,
  onQuickAddSearchSuggestion,
  onQuickAddSuggestion,
  onDismissSuggestion,
  isMutating,
  onAddManually,
  onScanPress,
  exitingItems: externalExitingItems,
  onExitComplete,
  initialSearchQuery = '',
  showImages = true,
  tutorialHint,
  children,
}: AddItemSheetProps<T>) {
  const { t } = useTranslation();
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

  // Drill-down view state: when set, the sheet shows one source's full list
  // instead of the multi-section overview.
  const [activeSourceKey, setActiveSourceKey] = useState<string | null>(null);

  // Determine when to show search results vs suggestions
  const hasSearchQuery = autocomplete.searchTerm.length >= 2;
  const hasSearchData =
    autocomplete.displayItems.length > 0 ||
    (hasSearchQuery && !autocomplete.isLoading);
  const showSearchResults = hasSearchQuery && hasSearchData;
  const showSuggestions = !showSearchResults;

  // Resolve the drilled-into section (if any) and its full item list. The
  // drill-down is shown only while its source still has items, so emptying the
  // list (adding everything) falls back to the overview without extra state.
  const activeGroup = activeSourceKey
    ? config.suggestionGroups.find(g => g.key === activeSourceKey)
    : undefined;
  const activeItems = activeGroup
    ? activeGroup.accessor(suggestions.grouped)
    : [];
  const inDrilldown =
    !!activeGroup && activeItems.length > 0 && showSuggestions;

  // Search handler - called after BottomSheetSearchBar debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    handleSearchTermChange(text);
    // Searching always returns to the overview/results, never the drill-down.
    if (text.length >= 2) {
      setActiveSourceKey(null);
    }
  };

  // useStandardBottomSheet handles present/dismiss. Effect-driven side
  // tasks: clear the search bar when the sheet opens, reset autocomplete on
  // close. Effect runs after commit so ref access is safe.
  const isOpen = visible && !!contextId;

  // Reset the drill-down whenever the sheet's open state changes so it always
  // opens on the overview and never reopens into a stale drilled-in source.
  // Adjusting state during render (not an effect) per the React Compiler rules.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    setActiveSourceKey(null);
  }

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

  // Render a suggestion item with exit animation support. `dismissible` adds
  // the ✕ control for sources the API can suppress.
  const renderSuggestionItem = (item: T, dismissible = false) => {
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
        onDismiss={
          dismissible && onDismissSuggestion
            ? () => onDismissSuggestion(item)
            : undefined
        }
        quickAddDisabled={isExiting}
        isExiting={isExiting}
        onExitComplete={
          onExitComplete ? () => onExitComplete(itemId) : undefined
        }
        showImage={showImages}
      />
    );
  };

  // Render a section of suggestions — capped to a preview, with a "More"
  // affordance that drills into the source's full list.
  const renderSuggestionSection = (groupConfig: SuggestionGroupConfig<T>) => {
    const items = groupConfig.accessor(suggestions.grouped);
    if (items.length === 0) return null;

    const preview = items.slice(0, PREVIEW_COUNT);
    const hasMore = items.length > PREVIEW_COUNT;
    const sectionTitle = t(groupConfig.titleKey);

    return (
      <View key={groupConfig.key} style={styles.suggestionSection}>
        <View style={styles.sectionHeader}>
          <Text
            size="sm"
            weight="semibold"
            tone="secondary"
            style={styles.sectionTitle}
          >
            {sectionTitle}
          </Text>
          {!!hasMore && (
            <AppPressable
              onPress={() => setActiveSourceKey(groupConfig.key)}
              style={styles.moreButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t('addItemSheet.more')} ${sectionTitle}`}
            >
              <Text size="sm" weight="semibold" tone="accent">
                {t('addItemSheet.more')}
              </Text>
              <Icon name="chevron-forward" size={16} tone="primary" />
            </AppPressable>
          )}
        </View>
        <View style={styles.suggestionList}>
          {preview.map(item =>
            renderSuggestionItem(item, !!groupConfig.dismissible),
          )}
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
          {inDrilldown && activeGroup ? (
            <SuggestionDrilldown
              title={t(activeGroup.titleKey)}
              items={activeItems}
              renderItem={item =>
                renderSuggestionItem(item, !!activeGroup.dismissible)
              }
              onBack={() => setActiveSourceKey(null)}
              backLabel={t('labels.back')}
              emptyLabel={t('addItemSheet.allAdded')}
            />
          ) : (
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
                    label={t('addItemSheet.scanBarcode')}
                    onPress={onScanPress}
                  />
                  <ActionCard
                    icon="add"
                    label={t('addItemSheet.addManually')}
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
                      <PrimaryActivityIndicator size="small" />
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
          )}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    letterSpacing: 1,
    // Titles are stored title-case for the drill-down header; the compact
    // overview header keeps its uppercase treatment via text-transform.
    textTransform: 'uppercase',
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
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
