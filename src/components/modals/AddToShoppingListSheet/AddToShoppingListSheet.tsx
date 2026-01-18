import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
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
  useShoppingListSuggestions,
  ShoppingListSuggestionItem,
} from '#hooks/shoppingList';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { toastService } from '#/services/toastService';
import { useAppStore } from '#store/useAppStore';
import {
  useAddItemToShoppingListMutation,
  useAutocompleteItemsLazyQuery,
  ItemSuggestion,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { useErrorHandler } from '#/utils/errorHandling';
import {
  ItemSuggestionsList,
  BottomSheetSearchBar,
  ActionCard,
  SuggestionListItem,
  type BottomSheetSearchBarRef,
} from '#components/molecules';

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
  const searchBarRef = useRef<BottomSheetSearchBarRef>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  const { navigate, navigateTo } = useAppNavigation();
  useBottomSheetBackHandler(bottomSheetRef, visible);

  // Online status for autocomplete
  const isOnline = useAppStore(state => state.isOnline);

  // Error handler for Apollo mutations
  const { handleApolloError } = useErrorHandler();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Autocomplete query for search
  const [fetchItems, { data: autocompleteData, loading: searchLoading }] =
    useAutocompleteItemsLazyQuery({ fetchPolicy: 'cache-and-network' });

  const searchSuggestions =
    autocompleteData?.autocompleteItems?.suggestions ?? [];

  // Fetch combined suggestions (recently deleted, frequently added, popular)
  const {
    grouped,
    loading: loadingSuggestions,
    hasSuggestions,
    refetch,
  } = useShoppingListSuggestions({
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
    if (visible && shoppingListId) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
      // Clear search when closing
      searchBarRef.current?.clear();
      setSearchQuery('');
    }
  }, [visible, shoppingListId]);

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
        initialItemName: searchBarRef.current?.getValue()?.trim() || undefined,
      });
    }
  }, [onClose, navigate, shoppingListId]);

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
        searchBarRef.current?.clear();
        setSearchQuery('');
        onItemAdded?.();
      } catch {
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
      } catch {
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
  const renderSuggestionItem = useCallback(
    (item: ShoppingListSuggestionItem) => (
      <SuggestionListItem
        key={item.id}
        imageUrl={item.imageUrl}
        title={item.name}
        subtitle={item.category}
        placeholderIcon="shopping-cart"
        onQuickAdd={() => handleQuickAddSuggestion(item)}
        quickAddDisabled={adding}
      />
    ),
    [adding, handleQuickAddSuggestion],
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
      testID="add-shopping-item-modal"
    >
      <View style={{ flex: 1 }} testID="add-shopping-item-modal">
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
        <BottomSheetSearchBar
          ref={searchBarRef}
          placeholder="Search or scan item..."
          onChangeText={handleSearchChange}
          onClear={() => setSearchQuery('')}
          initialValue={initialSearchQuery}
          autoCapitalize="none"
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
          <ActionCard
            icon="qr-code-scanner"
            label="Scan Barcode"
            onPress={handleScanPress}
          />
          <ActionCard
            icon="add"
            label="Add Manually"
            onPress={handleAddManually}
            testID="add-shopping-add-manually-button"
          />
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
                      Add items to your list and they'll appear here for quick
                      re-adding
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </BottomSheetScrollView>
      </View>
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
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
}));
