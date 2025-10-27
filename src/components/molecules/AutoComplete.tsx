import React, { useMemo, useEffect } from 'react';
import { Text, TouchableOpacity, View, Image } from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { getItemImageUrl } from '#utils/imageUtils';

interface AutocompleteProps {
  searchTerm: string;
  onSelectItem: (item: ItemSuggestion) => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  searchTerm,
  onSelectItem,
}) => {
  const [fetchItems, { data, loading, error }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (searchTerm.length >= 2) {
      fetchItems({ variables: { input: { query: searchTerm } } });
    }
  }, [searchTerm, fetchItems]);

  const suggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return data?.autocompleteItems?.suggestions || [];
  }, [data, searchTerm]);

  const totalCount = data?.autocompleteItems?.totalCount || 0;

  if (error) {
    return (
      <BottomSheetView style={styles.messageContainer}>
        <Text style={styles.errorText}>Error loading suggestions</Text>
        <Text style={styles.errorSubtext}>Please try again</Text>
      </BottomSheetView>
    );
  }

  if (searchTerm.length < 2) return null;

  const renderItem = ({ item }: { item: ItemSuggestion }) => {
    const imageUrl = getItemImageUrl(item);

    return (
      <TouchableOpacity
        onPress={() => onSelectItem(item)}
        style={styles.item}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.itemImage}
              defaultSource={{
                uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
              }}
            />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Text style={styles.itemImagePlaceholderText}>📦</Text>
            </View>
          )}
          <Text style={styles.itemName}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (loading) {
      return (
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Searching...</Text>
        </View>
      );
    }

    if (totalCount > 0) {
      return (
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            {totalCount} item{totalCount !== 1 ? 's' : ''} found
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderEmpty = () => (
    <BottomSheetView style={styles.messageContainer}>
      <Text style={styles.emptyText}>No items found</Text>
      <Text style={styles.emptySubtext}>
        Try a different search term or continue typing to add "{searchTerm}"
      </Text>
    </BottomSheetView>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerContainer}>
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <BottomSheetFlatList
      style={styles.flatList}
      contentContainerStyle={styles.flatListContent}
      data={suggestions}
      keyExtractor={(item: ItemSuggestion) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 20, // Normal padding since keyboard is handled by bottom sheet
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: theme.colors.surface,
  },
  itemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 20,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  messageContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}));

export default Autocomplete;
