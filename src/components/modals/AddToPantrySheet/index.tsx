import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useAppNavigation } from '#hooks';
import { usePantryItemSuggestions, type PantryItemSuggestion } from '#hooks/pantry';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { toastService } from '#/services/toastService';
import { Icon } from '#utils';
import { useAppStore } from '#store/useAppStore';
import {
  useCreatePantryItemMutation,
  useAutocompleteItemsLazyQuery,
  useGetPantryQuery,
  ItemSuggestion,
} from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { ItemSuggestionsList } from '#components/molecules';
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
  const animationConfigs = useSharedBottomSheetConfigs();
  const { navigateTo } = useAppNavigation();

  // Online status for autocomplete
  const isOnline = useAppStore(state => state.isOnline);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Add details sheet state
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [prefilledItemName, setPrefilledItemName] = useState('');

  // Autocomplete query
  const [fetchItems, { data: autocompleteData, loading: searchLoading }] =
    useAutocompleteItemsLazyQuery({ fetchPolicy: 'cache-and-network' });

  const searchSuggestions =
    autocompleteData?.autocompleteItems?.suggestions ?? [];

  // Fetch pantry item suggestions (replaces popular items and recently deleted)
  const {
    grouped: suggestionGroups,
    loading: loadingSuggestions,
    hasSuggestions,
    refetch: refetchSuggestions,
  } = usePantryItemSuggestions({
    pantryId,
    limit: 15,
    skip: !visible,
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

  // Debounced autocomplete search (250ms)
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Only search when online and query is long enough
    if (searchQuery.length >= 2 && isOnline) {
      debounceTimerRef.current = setTimeout(() => {
        fetchItems({ variables: { input: { query: searchQuery, limit: 10 } } });
      }, 250);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isOnline, fetchItems]);

  // Control bottom sheet visibility
  useEffect(() => {
    if (visible && pantryId) {
      bottomSheetRef.current?.present();
      setSearchQuery('');
      setShowAddDetails(false);
      setPrefilledItemName('');
    } else {
      bottomSheetRef.current?.dismiss();
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
    setPrefilledItemName(searchQuery);
    setShowAddDetails(true);
  }, [searchQuery]);

  // Handle quick add from autocomplete suggestion
  const handleQuickAddSearchSuggestion = useCallback(
    async (item: ItemSuggestion) => {
      if (!pantryId || creating) return;

      try {
        await createPantryItem({
          variables: {
            input: {
              pantryId,
              itemId: item.id,
              itemName: item.name,
              quantity: 1,
            },
          },
        });

        toastService.success(`Added ${item.name} (Qty: 1)`);
        setSearchQuery(''); // Clear search after adding
        refetchSuggestions();
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [pantryId, creating, createPantryItem, refetchSuggestions],
  );

  // Handle quick add from pantry item suggestion
  const handleQuickAddSuggestion = useCallback(
    async (item: PantryItemSuggestion) => {
      if (!pantryId || creating) return;

      try {
        await createPantryItem({
          variables: {
            input: {
              pantryId,
              itemId: item.itemId,
              itemName: item.name,
              quantity: 1,
            },
          },
        });

        toastService.success(`Added ${item.name} (Qty: 1)`);
        refetchSuggestions();
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [pantryId, creating, createPantryItem, refetchSuggestions],
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

  // Render a suggestion item with image
  const renderSuggestionItem = useCallback(
    (item: PantryItemSuggestion) => (
      <TouchableOpacity
        key={item.id}
        style={styles.suggestionItem}
        onPress={() => handleQuickAddSuggestion(item)}
        disabled={creating}
      >
        <View style={styles.suggestionImageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.suggestionImage}
            />
          ) : (
            <View style={styles.suggestionImagePlaceholder}>
              <Icon
                name="inventory-2"
                size={20}
                color={theme.colors.primary}
                library="MaterialIcons"
              />
            </View>
          )}
        </View>
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.category && (
            <Text style={styles.suggestionCategory} numberOfLines={1}>
              {item.category}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => handleQuickAddSuggestion(item)}
          disabled={creating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name="add"
            size={20}
            color={theme.colors.primary}
            library="MaterialIcons"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [creating, handleQuickAddSuggestion, theme.colors.primary],
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
        snapPoints={['70%']}
        enablePanDownToClose
        enableDynamicSizing={false}
        topInset={insets.top}
        onDismiss={onClose}
        animationConfigs={animationConfigs}
        backgroundStyle={{ backgroundColor: theme.colors.background }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
        backdropComponent={props => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close"
          />
        )}
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
          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={20}
              color={theme.colors.textSecondary}
              library="MaterialIcons"
            />
            <BottomSheetTextInput
              style={styles.searchInput}
              placeholder="Search or scan item..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Icon
                  name="close"
                  size={20}
                  color={theme.colors.textSecondary}
                  library="MaterialIcons"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.scanIconButton}
              onPress={handleScanPress}
            >
              <Icon
                name="qr-code-scanner"
                size={24}
                color={theme.colors.primary}
                library="MaterialIcons"
              />
            </TouchableOpacity>
          </View>

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
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleScanPress}
            >
              <View style={styles.actionIconContainer}>
                <Icon
                  name="qr-code-scanner"
                  size={32}
                  color={theme.colors.primary}
                  library="MaterialIcons"
                />
              </View>
              <Text style={styles.actionButtonText}>Scan Barcode</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddManually}
            >
              <View style={styles.actionIconContainer}>
                <Icon
                  name="add"
                  size={32}
                  color={theme.colors.primary}
                  library="MaterialIcons"
                />
              </View>
              <Text style={styles.actionButtonText}>Add Manually</Text>
            </TouchableOpacity>
          </View>

          {/* Suggestions Sections - shown when search is empty */}
          {showSuggestions && (
            <>
              {loadingSuggestions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
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
                  {renderSuggestionSection('LOW STOCK', suggestionGroups.lowStock)}
                  {renderSuggestionSection('EXPIRING SOON', suggestionGroups.expiringSoon)}
                  {renderSuggestionSection('ADD AGAIN', suggestionGroups.recentlyDeleted)}
                  {renderSuggestionSection('YOUR FAVORITES', suggestionGroups.frequentlyAdded)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  scanIconButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.lg,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
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
  // Suggestion sections with images
  suggestionSection: {
    marginBottom: theme.spacing.lg,
  },
  suggestionList: {
    gap: theme.spacing.xs,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  suggestionImageContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  suggestionImagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  suggestionCategory: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
