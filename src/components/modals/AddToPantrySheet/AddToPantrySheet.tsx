import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { View, Text, ActivityIndicator } from 'react-native';
// Note: LinearTransition removed due to JSI assertion failure on app launch
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useSharedBottomSheetConfigs,
  useAppNavigation,
  useBottomSheetBackHandler,
} from '#hooks';
import {
  usePantryItemSuggestions,
  type PantryItemSuggestion,
} from '#hooks/pantry';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { toastService } from '#/services/toastService';
import { useAppStore } from '#store/useAppStore';
import {
  useCreatePantryItemMutation,
  useAutocompleteItemsLazyQuery,
  useGetPantryQuery,
  GetPantryItemSuggestionsDocument,
  GetPantryItemSuggestionsQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import {
  ItemSuggestionsList,
  BottomSheetSearchBar,
  ActionCard,
  SuggestionListItem,
  type BottomSheetSearchBarRef,
} from '#components/molecules';
import { AddDetailsSheet } from './AddDetailsSheet';

interface AddToPantrySheetProps {
  visible: boolean;
  pantryId: string | undefined;
  onClose: () => void;
}

export const AddToPantrySheet: React.FC<AddToPantrySheetProps> = ({
  visible,
  pantryId,
  onClose,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const searchBarRef = useRef<BottomSheetSearchBarRef>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  const { navigateTo } = useAppNavigation();
  useBottomSheetBackHandler(bottomSheetRef, visible);
  const client = useApolloClient();

  // Online status for autocomplete
  const isOnline = useAppStore(state => state.isOnline);

  // Search input state (updated after debounce)
  const [searchQuery, setSearchQuery] = useState('');

  // Add details sheet state
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [prefilledItemName, setPrefilledItemName] = useState('');

  // Track items currently animating out
  const [exitingItems, setExitingItems] = useState<Set<string>>(new Set());

  // Defer query execution until sheet animation completes
  const [shouldFetch, setShouldFetch] = useState(false);

  // Autocomplete query
  const [fetchItems, { data: autocompleteData, loading: searchLoading }] =
    useAutocompleteItemsLazyQuery({ fetchPolicy: 'cache-and-network' });

  const searchSuggestions =
    autocompleteData?.autocompleteItems?.suggestions ?? [];

  // Fetch pantry item suggestions (replaces popular items and recently deleted)
  // Defer fetch until shouldFetch is true to avoid blocking sheet animation
  const {
    grouped: suggestionGroups,
    loading: loadingSuggestions,
    hasSuggestions,
    refetch: refetchSuggestions,
  } = usePantryItemSuggestions({
    pantryId,
    limit: 15,
    skip: !visible || !shouldFetch,
  });

  // Fetch pantry to get storage locations
  // PERFORMANCE: Only query when sheet is visible to prevent query from Shopping List screen
  const { data: pantryData } = useGetPantryQuery({
    variables: { id: pantryId ?? '' },
    skip: !pantryId || !visible,
    fetchPolicy: 'cache-first',
  });

  const normalizedPantry = pantryData?.pantry
    ? normalizePantry(pantryData.pantry)
    : null;
  const storageLocations = normalizedPantry?.storageLocations || [];

  // Helper to optimistically remove item from suggestions cache (prevents flickering)
  const removeFromSuggestionsCache = useCallback(
    (itemId: string) => {
      client.cache.updateQuery<GetPantryItemSuggestionsQuery>(
        {
          query: GetPantryItemSuggestionsDocument,
          variables: { pantryId: pantryId!, limit: 15 },
        },
        data => {
          if (!data) return data;
          return {
            ...data,
            pantryItemSuggestions: data.pantryItemSuggestions.filter(
              s => s.itemId !== itemId,
            ),
          };
        },
      );
    },
    [client.cache, pantryId],
  );

  // Create pantry item mutation for quick add
  const [createPantryItem, { loading: creating }] = useCreatePantryItemMutation(
    {
      update: (cache, { data }) => {
        if (!data?.createPantryItem || !pantryId) return;

        try {
          const addToPantryCache = createAddToParentConnectionUpdater(
            'Pantry',
            'itemsConnection',
            'PantryItem',
          );
          addToPantryCache(cache, pantryId, data.createPantryItem);
        } catch (error) {
          console.warn('Cache update failed for createPantryItem:', error);
        }
      },
    },
  );

  // Search handler - called after BottomSheetSearchBar debounce
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      // Only search when online and query is long enough
      if (text.length >= 2 && isOnline) {
        fetchItems({ variables: { input: { query: text, limit: 10 } } });
      }
    },
    [isOnline, fetchItems],
  );

  // Control bottom sheet visibility
  useEffect(() => {
    if (visible && pantryId) {
      bottomSheetRef.current?.present();
      // Clear search bar and state
      searchBarRef.current?.clear();
      setSearchQuery('');
      setShowAddDetails(false);
      setPrefilledItemName('');

      // Defer fetch until after sheet animation (50ms)
      const timer = setTimeout(() => setShouldFetch(true), 50);
      return () => clearTimeout(timer);
    } else {
      bottomSheetRef.current?.dismiss();
      setShouldFetch(false); // Reset on close
    }
  }, [visible, pantryId]);

  // Handle scan barcode press
  const handleScanPress = useCallback(() => {
    onClose();
    navigateTo.barcode({
      source: 'pantry',
      pantryId,
    });
  }, [onClose, navigateTo, pantryId]);

  // Handle add manually press
  const handleAddManually = useCallback(() => {
    bottomSheetRef.current?.dismiss(); // Close main sheet first
    // Use ref value for immediate access (not debounced state)
    setPrefilledItemName(searchBarRef.current?.getValue() || '');
    setShowAddDetails(true);
  }, []);

  // Handle quick add from autocomplete suggestion (fire-and-forget pattern)
  const handleQuickAddSearchSuggestion = useCallback(
    (item: ItemSuggestion) => {
      if (!pantryId || creating) return;

      // 1. Show toast immediately (don't wait for mutation)
      toastService.success(`Added ${item.name} (Qty: 1)`);

      // 2. Clear search after adding
      searchBarRef.current?.clear();
      setSearchQuery('');

      // 3. Optimistically remove from suggestions cache
      removeFromSuggestionsCache(item.id);

      // 4. Fire mutation without await
      createPantryItem({
        variables: {
          input: {
            pantryId,
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
          },
        },
      }).catch(() => {
        toastService.error('Failed to add item. Please try again.');
      });
    },
    [pantryId, creating, createPantryItem, removeFromSuggestionsCache],
  );

  // Handle quick add from pantry item suggestion (fire-and-forget pattern)
  const handleQuickAddSuggestion = useCallback(
    (item: PantryItemSuggestion) => {
      if (!pantryId || creating || exitingItems.has(item.itemId)) return;

      // 1. Start exit animation immediately (optimistic)
      setExitingItems(prev => new Set(prev).add(item.itemId));

      // 2. Show toast immediately (don't wait for mutation)
      toastService.success(`Added ${item.name} (Qty: 1)`);

      // 3. Fire mutation without await
      createPantryItem({
        variables: {
          input: {
            pantryId,
            itemId: item.itemId,
            itemName: item.name,
            quantity: 1,
          },
        },
      }).catch(() => {
        // On error: remove from exiting, show error toast
        setExitingItems(prev => {
          const next = new Set(prev);
          next.delete(item.itemId);
          return next;
        });
        toastService.error('Failed to add item');
      });
    },
    [pantryId, creating, exitingItems, createPantryItem],
  );

  // Handle successful add from details sheet
  const handleAddSuccess = useCallback(() => {
    setShowAddDetails(false);
    setSearchQuery('');
    refetchSuggestions();

    toastService.success('Item added to pantry');
  }, [refetchSuggestions]);

  // Handle close details sheet
  const handleCloseDetails = useCallback(() => {
    setShowAddDetails(false);
    setPrefilledItemName('');
  }, []);

  // Determine if we should show search results
  const showSearchResults = searchQuery.length >= 2;

  // Show suggestions when search is empty
  const showSuggestions = !showSearchResults;

  // Handle exit animation complete - remove from cache and exiting state
  const handleExitComplete = useCallback(
    (itemId: string) => {
      removeFromSuggestionsCache(itemId);
      setExitingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    },
    [removeFromSuggestionsCache],
  );

  // Render a suggestion item with image and animation props
  const renderSuggestionItem = useCallback(
    (item: PantryItemSuggestion) => (
      <SuggestionListItem
        key={item.id}
        imageUrl={item.imageUrl}
        title={item.name}
        subtitle={item.category}
        placeholderIcon="inventory-2"
        onQuickAdd={() => handleQuickAddSuggestion(item)}
        quickAddDisabled={creating || exitingItems.has(item.itemId)}
        isExiting={exitingItems.has(item.itemId)}
        onExitComplete={() => handleExitComplete(item.itemId)}
      />
    ),
    [creating, exitingItems, handleQuickAddSuggestion, handleExitComplete],
  );

  // Render a section of suggestions
  const renderSuggestionSection = useCallback(
    (title: string, items: PantryItemSuggestion[]) => {
      if (items.length === 0) return null;
      return (
        <View style={styles.suggestionSection}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.suggestionList}>
            {items.map(renderSuggestionItem)}
          </View>
        </View>
      );
    },
    [renderSuggestionItem],
  );

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['70%', '95%']}
        enablePanDownToClose
        enableDynamicSizing={false}
        topInset={insets.top}
        onDismiss={onClose}
        animationConfigs={animationConfigs}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={props => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close"
          />
        )}
        // @ts-expect-error - BottomSheetModal doesn't officially support testID but it works
        testID="add-pantry-item-modal"
      >
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
          <Text style={styles.title}>Add to Pantry</Text>

          {/* Search Input */}
          <BottomSheetSearchBar
            ref={searchBarRef}
            placeholder="Search or scan item..."
            onChangeText={handleSearchChange}
            onClear={() => setSearchQuery('')}
            rightActions={[
              {
                icon: 'qr-code-scanner',
                onPress: handleScanPress,
              },
            ]}
          />

          {/* Search Results */}
          {showSearchResults && (
            <ItemSuggestionsList
              searchQuery={searchQuery}
              suggestions={searchSuggestions}
              loading={searchLoading}
              addManuallyPosition="top"
              onAddManually={handleAddManually}
              onSelectSuggestion={handleQuickAddSearchSuggestion}
              quickAddDisabled={creating}
              placeholderIcon="inventory-2"
              showBrands={false}
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <ActionCard
              icon="qr-code-scanner"
              label="Scan Barcode"
              onPress={handleScanPress}
            />
            <ActionCard
              icon="add"
              label="Add Manually"
              onPress={handleAddManually}
            />
          </View>

          {/* Suggestions Sections - shown when search is empty */}
          {showSuggestions && (
            <>
              {loadingSuggestions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                </View>
              ) : !hasSuggestions ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No suggestions yet</Text>
                  <Text style={styles.emptySubtext}>
                    Add items to your pantry to get personalized suggestions
                  </Text>
                </View>
              ) : (
                <>
                  {/* Priority order: LOW_STOCK > EXPIRING_SOON > RECENTLY_DELETED > FREQUENTLY_ADDED > POPULAR */}
                  {renderSuggestionSection(
                    'LOW STOCK',
                    suggestionGroups.lowStock,
                  )}
                  {renderSuggestionSection(
                    'EXPIRING SOON',
                    suggestionGroups.expiringSoon,
                  )}
                  {renderSuggestionSection(
                    'ADD AGAIN',
                    suggestionGroups.recentlyDeleted,
                  )}
                  {renderSuggestionSection(
                    'YOUR FAVORITES',
                    suggestionGroups.frequentlyAdded,
                  )}
                  {renderSuggestionSection('POPULAR', suggestionGroups.popular)}
                </>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* Nested Add Details Sheet */}
      <AddDetailsSheet
        visible={showAddDetails}
        pantryId={pantryId}
        prefilledItemName={prefilledItemName}
        storageLocations={storageLocations}
        onClose={handleCloseDetails}
        onSuccess={handleAddSuccess}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  suggestionSection: {
    marginBottom: theme.spacing.lg,
  },
  suggestionList: {
    gap: theme.spacing.xs,
  },
}));
