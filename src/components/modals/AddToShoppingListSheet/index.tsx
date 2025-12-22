import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useAppNavigation, usePopularItems } from '#hooks';
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
import { ItemRecentCard, ItemSuggestionsList } from '#components/molecules';

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

  // Fetch popular items for auto-suggest when search is empty
  const { popularItems, loading: loadingPopular } = usePopularItems(10);

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

  // Handle quick add from popular items
  const handleQuickAddPopular = useCallback(
    async (item: (typeof popularItems)[0]) => {
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
        onItemAdded?.();
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [shoppingListId, adding, addItemMutation, onItemAdded],
  );

  // Determine if we should show search results
  const showSearchResults = searchQuery.length >= 2;

  // Show popular items when search is empty or has few results
  const showPopularItems = !showSearchResults && popularItems.length > 0;

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
          <ItemSuggestionsList
            searchQuery={searchQuery}
            suggestions={suggestions}
            loading={searchLoading}
            addManuallyPosition="bottom"
            onAddManually={handleAddManually}
            onSelectSuggestion={handleQuickAddSuggestion}
            quickAddDisabled={adding}
            placeholderIcon="shopping-cart"
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

        {/* Popular Items Section - shown when search is empty */}
        {showPopularItems && (
          <View style={styles.popularSection}>
            <Text style={styles.sectionTitle}>POPULAR ITEMS</Text>
            {loadingPopular ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <View style={styles.popularList}>
                {popularItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.popularItem}
                    onPress={() => handleQuickAddPopular(item)}
                    disabled={adding}
                  >
                    <View style={styles.popularItemInfo}>
                      <Text style={styles.popularItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.brand && (
                        <Text style={styles.popularItemBrand} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.quickAddButton}
                      onPress={() => handleQuickAddPopular(item)}
                      disabled={adding}
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
                ))}
              </View>
            )}
          </View>
        )}

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
                <ItemRecentCard
                  key={item.id}
                  item={item}
                  onQuickAdd={handleQuickAddRecent}
                  disabled={adding}
                  placeholderIcon="shopping-cart"
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
  popularSection: {
    marginBottom: theme.spacing.xl,
  },
  popularList: {
    gap: theme.spacing.sm,
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  popularItemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  popularItemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  popularItemBrand: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
