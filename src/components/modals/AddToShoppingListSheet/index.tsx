import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useAppNavigation } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { toastService } from '#/services/toastService';
import { Icon } from '#utils';
import { useAppStore } from '#store/useAppStore';
import {
  useGetRecentlyDeletedShoppingListItemsQuery,
  useAddItemToShoppingListMutation,
  useAutocompleteItemsLazyQuery,
  ItemSuggestion,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { useErrorHandler } from '#/utils/errorHandling';
import { RecentItemCard } from './RecentItemCard';

interface AddToShoppingListSheetProps {
  visible: boolean;
  shoppingListId: string | undefined;
  onClose: () => void;
  /** Initial search query to pre-populate when sheet opens */
  initialSearchQuery?: string;
  /** Called when an item is successfully added */
  onItemAdded?: () => void;
}

export const AddToShoppingListSheet: React.FC<AddToShoppingListSheetProps> = ({
  visible,
  shoppingListId,
  onClose,
  initialSearchQuery = '',
  onItemAdded,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  const { navigate, navigateTo } = useAppNavigation();

  // Online status for autocomplete
  const isOnline = useAppStore(state => state.isOnline);

  // Error handler for Apollo mutations
  const { handleApolloError } = useErrorHandler();

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Autocomplete query
  const [fetchItems, { data: autocompleteData, loading: searchLoading }] =
    useAutocompleteItemsLazyQuery({ fetchPolicy: 'cache-and-network' });

  const suggestions = autocompleteData?.autocompleteItems?.suggestions ?? [];

  // Fetch recently deleted items
  // PERFORMANCE: Only fetch when sheet is visible to avoid unnecessary queries on screen mount
  // NOTE: Subscription handles updates automatically, no manual refetch needed
  const { data: recentData, loading: loadingRecent } =
    useGetRecentlyDeletedShoppingListItemsQuery({
      variables: { shoppingListId: shoppingListId ?? '', limit: 10 },
      skip: !shoppingListId || !visible,
      fetchPolicy: 'cache-and-network',
    });

  const recentItems = recentData?.recentlyDeletedShoppingListItems ?? [];

  // Add shopping list item mutation with error handling and debug logging
  const [addItemMutation, { loading: adding }] =
    useAddItemToShoppingListMutation({
      errorPolicy: 'all', // Return partial data + errors for debugging

      update: (cache, { data }) => {
        if (!data?.addItemToShoppingList || !shoppingListId) return;

        try {
          const addToShoppingListCache = createAddToParentConnectionUpdater(
            'ShoppingList',
            'itemsConnection',
            'ShoppingListItem',
          );
          addToShoppingListCache(
            cache,
            shoppingListId,
            data.addItemToShoppingList,
          );
        } catch (error) {
          console.error('Cache update failed:', error);
        }
      },

      onError: error => {
        console.error('AddItem mutation error:', error);
        const { message } = handleApolloError(error, {
          operation: 'Add Shopping List Item',
        });
        Alert.alert('Error Adding Item', message);
      },
    });

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

  // Track if we've initialized from the initial search query
  const hasInitializedRef = useRef(false);

  // Control bottom sheet visibility
  useEffect(() => {
    if (visible && shoppingListId) {
      bottomSheetRef.current?.present();
      // Only pre-populate on first open, not on every re-render
      if (!hasInitializedRef.current) {
        setSearchQuery(initialSearchQuery);
        hasInitializedRef.current = true;
      }
    } else {
      bottomSheetRef.current?.dismiss();
      // Reset initialization flag when sheet closes so it can be re-initialized next time
      hasInitializedRef.current = false;
    }
  }, [visible, shoppingListId, initialSearchQuery]);

  // Handle scan barcode press
  const handleScanPress = useCallback(() => {
    onClose();
    navigateTo.barcode({
      source: 'shoppingList',
      shoppingListId,
    });
  }, [onClose, navigateTo, shoppingListId]);

  // Handle add manually press - navigate to AddItem screen
  const handleAddManually = useCallback(() => {
    onClose();
    if (shoppingListId) {
      navigate('AddItem', {
        listId: shoppingListId,
        initialItemName: searchQuery.trim() || undefined,
      });
    }
  }, [onClose, navigate, shoppingListId, searchQuery]);

  // Handle quick add from autocomplete suggestion
  const handleQuickAddSuggestion = useCallback(
    async (item: ItemSuggestion) => {
      if (!shoppingListId || adding) return;

      try {
        await addItemMutation({
          variables: {
            input: {
              shoppingListId,
              itemId: item.id,
              itemName: item.name,
              quantity: 1,
            },
          },
        });

        toastService.success(`Added ${item.name}`);
        setSearchQuery(''); // Clear search after adding
        onItemAdded?.(); // Notify parent to clear main search
        // NOTE: Removed refetchRecent() - subscription handles updates
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [shoppingListId, adding, addItemMutation, onItemAdded],
  );

  // Handle quick add from recent items
  const handleQuickAddRecent = useCallback(
    async (item: (typeof recentItems)[0]) => {
      if (!shoppingListId || adding) return;

      // Convert null to undefined for GraphQL InputMaybe type
      const itemId = item.item?.id ?? undefined;
      const itemName = item.itemName ?? undefined;

      if (!itemName) {
        toastService.error('Item name is required');
        return;
      }

      try {
        await addItemMutation({
          variables: {
            input: {
              shoppingListId,
              ...(itemId && { itemId }),
              itemName,
              quantity: 1,
            },
          },
        });

        toastService.success(`Added ${itemName}`);
        onItemAdded?.(); // Notify parent to clear main search
        // NOTE: Removed refetchRecent() - subscription handles updates
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [shoppingListId, adding, addItemMutation, onItemAdded],
  );

  // Determine if we should show search results
  const showSearchResults = searchQuery.length >= 2;
  const hasResults = suggestions.length > 0;

  return (
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
        <Text style={styles.title}>Add to Shopping List</Text>

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
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="add-sheet-search-clear"
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
          <View style={styles.searchResultsContainer}>
            {searchLoading ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            ) : (
              <>
                {/* Autocomplete suggestions */}
                {suggestions.map((item: ItemSuggestion) => {
                  const imageUrl = item.imageUrl || null;
                  return (
                    <View key={item.id} style={styles.suggestionItem}>
                      <View style={styles.suggestionImageContainer}>
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.suggestionImage}
                          />
                        ) : (
                          <View style={styles.suggestionImagePlaceholder}>
                            <Icon
                              name="shopping-cart"
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
                        {item.brands && item.brands.length > 0 && (
                          <Text
                            style={styles.suggestionBrands}
                            numberOfLines={1}
                          >
                            {item.brands[0].name}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.quickAddButton,
                          adding && styles.quickAddButtonDisabled,
                        ]}
                        onPress={() => handleQuickAddSuggestion(item)}
                        disabled={adding}
                      >
                        <Icon
                          name="add"
                          size={20}
                          color={theme.colors.primary}
                          library="MaterialIcons"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Add manually option */}
                <TouchableOpacity
                  style={styles.addManuallyOption}
                  onPress={handleAddManually}
                >
                  <Icon
                    name="add-circle-outline"
                    size={20}
                    color={theme.colors.primary}
                    library="MaterialIcons"
                  />
                  <Text style={styles.addManuallyText}>
                    {hasResults
                      ? `Add "${searchQuery}" manually`
                      : `No matches. Add "${searchQuery}" manually`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
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

        {/* Recent Items Section */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>RECENT ITEMS</Text>

          {loadingRecent ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : recentItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recent items</Text>
              <Text style={styles.emptySubtext}>
                Items you delete will appear here for quick re-adding
              </Text>
            </View>
          ) : (
            <View style={styles.recentList}>
              {recentItems.map(item => (
                <RecentItemCard
                  key={item.id}
                  item={item}
                  onQuickAdd={handleQuickAddRecent}
                  disabled={adding}
                />
              ))}
            </View>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
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
  searchResultsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  searchLoadingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  suggestionName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  suggestionBrands: {
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
  quickAddButtonDisabled: {
    opacity: 0.5,
  },
  addManuallyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addManuallyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
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
  recentSection: {
    flex: 1,
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
  recentList: {
    gap: theme.spacing.sm,
  },
}));
