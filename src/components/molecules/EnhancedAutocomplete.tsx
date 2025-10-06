import React, { useMemo, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, Image, useWindowDimensions } from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';

interface EnhancedAutocompleteProps {
  searchTerm: string;
  onSelectItem: (item: ItemSuggestion) => void;
  headerContent?: React.ReactNode;
}

const EnhancedAutocomplete: React.FC<EnhancedAutocompleteProps> = ({
  searchTerm,
  onSelectItem,
  headerContent,
}) => {
  const { height } = useWindowDimensions();
  const [fetchItems, { data, loading, error }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  // Keep track of previous results to show during loading
  // Use the exact type from the GraphQL query to avoid type mismatches
  const [previousResults, setPreviousResults] = useState<ItemSuggestion[]>([]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      fetchItems({ variables: { input: { query: searchTerm } } });
    }
  }, [searchTerm, fetchItems]);

  // Update previous results when we get new data
  useEffect(() => {
    const newSuggestions = data?.autocompleteItems?.suggestions || [];
    if (newSuggestions.length > 0 || !loading) {
      setPreviousResults(newSuggestions);
    }
  }, [data, loading]);

  const suggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];

    const newSuggestions = data?.autocompleteItems?.suggestions || [];

    // If we have new data or not loading, return new suggestions
    if (newSuggestions.length > 0 || !loading) {
      return newSuggestions;
    }

    // If loading and no new data yet, show previous results
    return previousResults;
  }, [data, searchTerm, loading, previousResults]);

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

  const renderItem = ({ item }: { item: ItemSuggestion }) => (
    <TouchableOpacity
      onPress={() => onSelectItem(item)}
      style={styles.item}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
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
        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.brand?.name && (
            <Text style={styles.itemBrand}>Brand: {item.brand.name}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    const showingPreviousResults = loading && previousResults.length > 0;
    const currentCount = showingPreviousResults
      ? previousResults.length
      : totalCount;

    const resultsHeader = () => {
      if (loading && previousResults.length === 0) {
        return (
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Searching...</Text>
          </View>
        );
      }

      if (currentCount > 0) {
        return (
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>
              {currentCount} item{currentCount !== 1 ? 's' : ''} found
              {showingPreviousResults && (
                <Text style={styles.loadingIndicator}> • Updating...</Text>
              )}
            </Text>
          </View>
        );
      }

      return null;
    };

    return (
      <>
        {headerContent}
        {resultsHeader()}
      </>
    );
  };

  const renderEmpty = () => (
    <BottomSheetView style={[styles.messageContainer, { minHeight: height * 0.5 }]}>
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

  const showingPreviousResults = loading && previousResults.length > 0;

  return (
    <BottomSheetFlatList
      style={[
        styles.flatList,
        showingPreviousResults && styles.flatListLoading,
      ]}
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
  flatListLoading: {
    opacity: 0.8,
  },
  flatListContent: {
    paddingBottom: theme.spacing.lg,
    flexGrow: 1,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  loadingIndicator: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '400',
    color: theme.colors.primary,
    opacity: 0.8,
  },
  item: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  itemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 20,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  itemBrand: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs / 2,
  },
  itemCategory: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs / 2,
  },
  itemUnit: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  preferredUnit: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.warning,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  messageContainer: {
    flex: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.error,
    marginBottom: theme.spacing.xs,
  },
  errorSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  footerContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
}));

export default EnhancedAutocomplete;
