import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { Sheet } from '#components/templates/Sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import type { ItemSuggestion } from '#graphql/generated/schemaTypes';
import { ItemSuggestionsList } from '#features/catalog/ui/ItemSuggestionsList';
import { ReportItemForm } from '#features/catalog/ui/ReportItemForm/ReportItemForm';
import { SearchBar, type SearchBarRef } from '#components/molecules/SearchBar';
import { SuggestionListItem } from '#features/catalog/components/SuggestionListItem';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { useItemAutocomplete } from '#features/catalog/hooks/useItemAutocomplete';
import type { AddItemSheetProps, SuggestionGroupConfig } from './types';
import { SuggestionDrilldown } from './SuggestionDrilldown';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { DataStateView } from '#components/organisms/DataStateView';
import { catalogTestIDs } from '#features/catalog/testIDs';
import type { BaseSuggestionItem } from '#features/catalog/types';
import { useOpening } from '#hooks/ui/useOpening';

/**
 * How many rows each section shows in the overview before a "More" affordance
 * drills into that source's full list. Keeps any single source (e.g. a polluted
 * recently-deleted list) from taking over the sheet.
 */
const PREVIEW_COUNT = 5;

type AddItemSheetContentProps<T extends BaseSuggestionItem> = Omit<
  AddItemSheetProps<T>,
  'visible' | 'contextId'
>;

/**
 * One opening, on the step asked for, the overview and an empty search. The
 * suggestions render once the open animation has settled.
 */
function AddItemSheetContent<T extends BaseSuggestionItem>({
  onClose,
  config,
  suggestions,
  onQuickAddSearchSuggestion,
  onQuickAddSuggestion,
  onDismissSuggestion,
  onAddManually,
  startStep = 'search',
  initialSearchQuery = '',
  showImages = true,
  tutorialHint,
  renderDetails,
}: AddItemSheetContentProps<T>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const searchBarRef = useRef<SearchBarRef>(null);

  // ONE sheet morphs between search, details and report: a second
  // BottomSheetModal races the global backdrop, and gorhom's default
  // `stackBehavior: 'switch'` minimizes this sheet rather than stacking on it.
  const openingStep =
    startStep === 'details' && renderDetails ? 'details' : 'search';
  const [step, setStep] = useState<'search' | 'details' | 'report'>(
    openingStep,
  );
  const goBackToSearch = () => {
    setStep('search');
  };
  const [manualName, setManualName] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferRender = config.deferFetch;
  const [shouldRenderSuggestions, setShouldRenderSuggestions] = useState(
    !deferRender,
  );
  useEffect(() => {
    if (!deferRender) return;
    const idleId = requestIdleCallback(() => setShouldRenderSuggestions(true));
    return () => cancelIdleCallback(idleId);
  }, [deferRender]);

  // Autocomplete search — debounceMs: 0 because the search bar already debounces
  const autocomplete = useItemAutocomplete({ debounceMs: 0 });
  const { handleSearchTermChange, reset: resetAutocomplete } = autocomplete;
  // Opened on a search, it runs as a typed one does; the field only shows it.
  useEffect(() => {
    if (initialSearchQuery) handleSearchTermChange(initialSearchQuery);
  }, [initialSearchQuery, handleSearchTermChange]);

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

  // Search handler - called after the search bar debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    handleSearchTermChange(text);
    // Searching always returns to the overview/results, never the drill-down.
    if (text.length >= 2) {
      setActiveSourceKey(null);
    }
  };

  // Opened on the form: the owner preps its inputs, as "Add manually" does.
  useEffect(() => {
    if (startStep === 'details') onAddManually?.('');
  }, [startStep, onAddManually]);

  // With `renderDetails` this same sheet morphs to the details step, keeping
  // its search snap height; the user can drag it up to the 95% max.
  const handleAddManually = () => {
    const searchValue = searchBarRef.current?.getValue() ?? '';
    onAddManually?.(searchValue);
    if (renderDetails) {
      setManualName(searchValue);
      setStep('details');
    }
  };

  // Handle selecting a search suggestion
  const handleSelectSearchSuggestion = (item: ItemSuggestion) => {
    onQuickAddSearchSuggestion(item);
    // Clear search after adding
    searchBarRef.current?.clear();
    setSearchQuery('');
    resetAutocomplete();
  };

  // A suggestion row; it leaves with the data and animates out as it unmounts.
  // `dismissible` adds the ✕ control for sources the API can suppress.
  const renderSuggestionItem = (item: T, dismissible = false) => (
    <SuggestionListItem
      key={item.id}
      imageUrl={item.imageUrl}
      title={item.name}
      subtitle={item.subtitle ?? item.category}
      onQuickAdd={() => onQuickAddSuggestion(item)}
      onDismiss={
        dismissible && onDismissSuggestion
          ? () => onDismissSuggestion(item)
          : undefined
      }
      showImage={showImages}
    />
  );

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
          <SectionHeader variant="overline">{sectionTitle}</SectionHeader>
          {!!hasMore && (
            <AppPressable
              onPress={() => setActiveSourceKey(groupConfig.key)}
              style={styles.moreButton}
              accessibilityRole="button"
              accessibilityLabel={`${t('labels.more')} ${sectionTitle}`}
            >
              <Text role="label" tone="accent">
                {t('labels.more')}
              </Text>
              <Icon name="chevron-forward" size="xs" tone="primary" />
            </AppPressable>
          )}
        </View>
        {preview.map(item =>
          renderSuggestionItem(item, !!groupConfig.dismissible),
        )}
      </View>
    );
  };

  return (
    <View
      style={styles.sheetBody}
      testID={catalogTestIDs.addItemSheetModal(config.testIDPrefix)}
    >
      {step === 'report' ? (
        <ReportItemForm
          candidates={autocomplete.displayItems.map(item => ({
            id: item.id,
            name: item.name,
            imageUrl: item.imageUrl,
            brandName: item.brands[0]?.name,
          }))}
          onClose={goBackToSearch}
        />
      ) : step === 'details' && renderDetails ? (
        // Opened on the form, there is no search to go back to: back closes.
        renderDetails({
          goBack: openingStep === 'details' ? onClose : goBackToSearch,
          itemName: manualName,
        })
      ) : inDrilldown ? (
        <SuggestionDrilldown
          title={t(activeGroup.titleKey)}
          items={activeItems}
          renderItem={item =>
            renderSuggestionItem(item, !!activeGroup.dismissible)
          }
          onBack={() => setActiveSourceKey(null)}
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
          <Text role="subheading" style={styles.title}>
            {t(config.titleKey)}
          </Text>

          {/* Search Input */}
          <SearchBar
            ref={searchBarRef}
            containerStyle={styles.searchBar}
            testID={catalogTestIDs.addItemSheetSearchInput(config.testIDPrefix)}
            placeholder={t(config.searchPlaceholderKey)}
            onChangeText={handleSearchChange}
            onClear={() => setSearchQuery('')}
            // Remounted on the way back from a step, it shows the search the
            // results below still answer.
            value={searchQuery}
            debounceMs={250}
            autoCapitalize="words"
            returnKeyType="search"
            isLoading={!!autocomplete.isLoading && hasSearchQuery}
          />

          {/* Search Results */}
          {!!showSearchResults && (
            <ItemSuggestionsList
              searchQuery={searchQuery}
              suggestions={autocomplete.displayItems}
              addManuallyPosition={config.addManuallyPosition}
              testIDPrefix={config.testIDPrefix}
              onAddManually={handleAddManually}
              onSelectSuggestion={handleSelectSearchSuggestion}
              showBrands={false}
              showImages={showImages}
              onReportItem={() => setStep('report')}
            />
          )}

          {/* Tutorial hint (e.g. "Tap + next to an item to add it") */}
          {!!tutorialHint && !showSearchResults && tutorialHint}

          {/* Suggestions Sections - shown when search is empty, deferred until after animation */}
          {!!showSuggestions && !!shouldRenderSuggestions && (
            <>
              {suggestions.state === 'loading' ? (
                <View style={styles.centeredSpinner}>
                  <PrimaryActivityIndicator size="small" />
                </View>
              ) : suggestions.state === 'error' ||
                suggestions.state === 'offline' ? (
                <DataStateView
                  state={suggestions.state}
                  onRetry={suggestions.refetch}
                />
              ) : suggestions.state === 'empty' ? (
                <View style={styles.emptyInset}>
                  <Text
                    role="bodyStrong"
                    tone="secondary"
                    style={styles.emptyMessage}
                  >
                    {t(config.emptyStateMessageKey)}
                  </Text>
                  <Text role="caption" tone="tertiary" align="center">
                    {t(config.emptyStateSubtextKey)}
                  </Text>
                </View>
              ) : (
                // The rows painted with the sheet do not fade in; a row that
                // arrives later (a refill, an undo) does.
                <LayoutAnimationConfig skipEntering>
                  {/* Render suggestion sections in priority order. Copy
                        before sorting — `.sort()` mutates in place, and the
                        array belongs to the caller's `config` prop. */}
                  {[...config.suggestionGroups]
                    .sort((a, b) => a.priority - b.priority)
                    .map(renderSuggestionSection)}
                </LayoutAnimationConfig>
              )}
            </>
          )}
        </BottomSheetScrollView>
      )}
    </View>
  );
}

/** Shared add-item bottom sheet, used by AddToPantrySheet and AddToShoppingListSheet. */
export function AddItemSheet<
  T extends BaseSuggestionItem = BaseSuggestionItem,
>({ visible, contextId, ...content }: AddItemSheetProps<T>) {
  const open = visible && !!contextId;
  const opening = useOpening(open);

  return (
    <Sheet
      mode="list"
      visible={open}
      onDismiss={content.onClose}
      snapPoints={['95%']}
      keyboardBehavior="extend"
      // Every step scrolls itself and pads its own end.
      bottomInset="content"
    >
      {opening ? <AddItemSheetContent key={opening.id} {...content} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  // A plain flex parent, not BottomSheetView: a scrollable inside that one is
  // never height-bounded.
  sheetBody: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.lg,
  },
  // The sections and results below carry no top margin of their own.
  searchBar: {
    marginBottom: theme.spacing.lg,
  },
  // Every header is as tall as the "More" target some hold, so all sections
  // keep one rhythm.
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: theme.sizes.touchTarget.min,
    marginBottom: theme.spacing.xs,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
    minHeight: theme.sizes.touchTarget.min,
  },
  centeredSpinner: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyInset: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyMessage: {
    marginBottom: theme.spacing.xs,
  },
  suggestionSection: {
    marginBottom: theme.spacing.lg,
  },
}));
