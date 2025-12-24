import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
import {
  useShoppingListSuggestions,
  ShoppingListSuggestionItem,
} from '#hooks/shoppingList';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { toastService } from '#/services/toastService';
import { Icon } from '#utils';
import { useAppStore } from '#store/useAppStore';
import {
  useAddItemToShoppingListMutation,
  useAutocompleteItemsLazyQuery,
  ItemSuggestion,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { useErrorHandler } from '#/utils/errorHandling';
import { ItemSuggestionsList } from '#components/molecules';

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

  // Autocomplete query for search
  const [fetchItems, { data: autocompleteData, loading: searchLoading }] =
    useAutocompleteItemsLazyQuery({ fetchPolicy: 'cache-and-network' });

  const searchSuggestions = autocompleteData?.autocompleteItems?.suggestions ?? [];

  // Fetch combined suggestions (recently deleted, frequently added, popular)
  const { grouped, loading: loadingSuggestions, hasSuggestions, refetch } =
    useShoppingListSuggestions({
      shoppingListId,
      limit: 15,
      skip: !visible,
    });

  // Add shopping list item mutation with error handling
  const [addItemMutation, { loading: adding }] =
    useAddItemToShoppingListMutation({
      errorPolicy: 'all',

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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

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
      if (!hasInitializedRef.current) {
        setSearchQuery(initialSearchQuery);
        hasInitializedRef.current = true;
      }
    } else {
      bottomSheetRef.current?.dismiss();
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

  // Handle add manually press
  const handleAddManually = useCallback(() => {
    onClose();
    if (shoppingListId) {
      navigate('AddItem', {
        listId: shoppingListId,
        initialItemName: searchQuery.trim() || undefined,
      });
    }
  }, [onClose, navigate, shoppingListId, searchQuery]);

  // Handle quick add from search autocomplete suggestion
  const handleQuickAddSearchSuggestion = useCallback(
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
              // Use default unit if available
              unitId: item.defaultUnit?.id,
            },
          },
        });

        toastService.success(`Added ${item.name}`);
        setSearchQuery('');
        onItemAdded?.();
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [shoppingListId, adding, addItemMutation, onItemAdded],
  );

  // Handle quick add from suggestion (unified handler for all sources)
  const handleQuickAddSuggestion = useCallback(
    async (item: ShoppingListSuggestionItem) => {
      if (!shoppingListId || adding) return;

      // Use lastUnitId if available (for recently deleted), otherwise defaultUnitId
      const unitId = item.lastUnitId ?? item.defaultUnitId ?? undefined;

      try {
        await addItemMutation({
          variables: {
            input: {
              shoppingListId,
              itemId: item.itemId,
              itemName: item.name,
              quantity: 1,
              unitId,
            },
          },
        });

        toastService.success(`Added ${item.name}`);
        onItemAdded?.();
        refetch();
      } catch (error) {
        toastService.error('Failed to add item. Please try again.');
      }
    },
    [shoppingListId, adding, addItemMutation, onItemAdded, refetch],
  );

  // Determine if we should show search results
  const showSearchResults = searchQuery.length >= 2;

  // Show suggestions when search is empty
  const showSuggestions = !showSearchResults;

  // Render a single suggestion item with image
  const renderSuggestionItem = (item: ShoppingListSuggestionItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.suggestionItem}
      onPress={() => handleQuickAddSuggestion(item)}
      disabled={adding}
    >
      <View style={styles.suggestionImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.suggestionImage} />
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
      <View style={styles.suggestionItemInfo}>
        <Text style={styles.suggestionItemName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.category && (
          <Text style={styles.suggestionItemCategory} numberOfLines={1}>
            {item.category}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.quickAddButton}
        onPress={() => handleQuickAddSuggestion(item)}
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
  );

  // Render a suggestion section
  const renderSection = (
    title: string,
    items: ShoppingListSuggestionItem[],
    emptyMessage?: string,
  ) => {
    if (items.length === 0 && !emptyMessage) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length === 0 && emptyMessage ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <View style={styles.suggestionList}>
            {items.map(renderSuggestionItem)}
          </View>
        )}
      </View>
    );
  };

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
            suggestions={searchSuggestions}
            loading={searchLoading}
            addManuallyPosition="bottom"
            onAddManually={handleAddManually}
            onSelectSuggestion={handleQuickAddSearchSuggestion}
            quickAddDisabled={adding}
            placeholderIcon="shopping-cart"
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

        {/* Suggestions Sections - shown when not searching */}
        {showSuggestions && (
          <>
            {loadingSuggestions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <>
                {/* Add Again - Recently Deleted */}
                {renderSection('ADD AGAIN', grouped.recentlyDeleted)}

                {/* Your Favorites - Frequently Added */}
                {renderSection('YOUR FAVORITES', grouped.frequentlyAdded)}

                {/* Popular Items */}
                {renderSection('POPULAR', grouped.popular)}

                {/* Empty state when no suggestions */}
                {!hasSuggestions && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No suggestions yet</Text>
                    <Text style={styles.emptySubtext}>
                      Add items to your list and they'll appear here for quick re-adding
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
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
  section: {
    marginBottom: theme.spacing.lg,
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
  suggestionList: {
    gap: theme.spacing.sm,
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
  suggestionItemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  suggestionItemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  suggestionItemCategory: {
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
