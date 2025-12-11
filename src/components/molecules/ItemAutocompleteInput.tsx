import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAppStore } from '#store/useAppStore';
import { getItemImageUrl } from '#utils/imageUtils';

interface ItemAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onSelectItem?: (item: ItemSuggestion) => void;
  autoFocus?: boolean;
  testID?: string;
}

export const ItemAutocompleteInput: React.FC<ItemAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onSelectItem,
  testID,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // PERFORMANCE: Use selective subscription instead of full store
  const isOnline = useAppStore(state => state.isOnline);

  // PERFORMANCE: Debounce timer to prevent request floods
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  // PERFORMANCE: Debounce autocomplete queries to prevent request floods (250ms)
  useEffect(() => {
    // Clear existing timer on term/online change
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Only query when online and search term is long enough
    if (searchTerm.length >= 2 && isOnline) {
      debounceTimerRef.current = setTimeout(() => {
        fetchItems({
          variables: { input: { query: searchTerm } },
        });
      }, 250); // 250ms debounce
    }

    // Cleanup on unmount or term change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [searchTerm, fetchItems, isOnline]);

  const items = data?.autocompleteItems?.suggestions || [];

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
  };

  const handleSelectItem = (item: ItemSuggestion) => {
    onChangeText(item.name.trim());
    onSelectItem?.(item);
  };

  const renderItemOption = (item: ItemSuggestion) => {
    const imageUrl = getItemImageUrl(item);

    return (
      <TouchableOpacity
        onPress={() => handleSelectItem(item)}
        style={styles.itemOption}
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
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.brands && item.brands.length === 1 && (
              <Text style={styles.itemBrand}>{item.brands[0].name}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheetAutocompleteInput
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      title="Search for an item"
      searchPlaceholder="Type to search items..."
      minSearchLength={2}
      data={items}
      loading={loading}
      renderItem={renderItemOption}
      keyExtractor={(item: ItemSuggestion) => item.id}
      onSelectItem={handleSelectItem}
      emptyText="No items found"
      emptySubtext={
        searchTerm.length >= 2
          ? `Continue typing to add "${searchTerm}"`
          : 'Type at least 2 characters to search'
      }
      onSearchChange={setSearchTerm}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  itemOption: {
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
  },
}));
