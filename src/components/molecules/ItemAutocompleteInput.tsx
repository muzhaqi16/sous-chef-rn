import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useStore } from '#store';
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
}

export const ItemAutocompleteInput: React.FC<ItemAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onSelectItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Check online status to prevent queries when offline
  const isOnline = useStore(state => state.isOnline);

  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    // Only query when online and search term is long enough
    if (searchTerm.length >= 2 && isOnline) {
      fetchItems({
        variables: { input: { query: searchTerm } },
      });
    }
  }, [searchTerm, fetchItems, isOnline]);

  const items = data?.autocompleteItems?.suggestions || [];

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
  };

  const handleSelectItem = (item: ItemSuggestion) => {
    onChangeText(item.name);
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
            {item.brand?.name && (
              <Text style={styles.itemBrand}>Brand: {item.brand.name}</Text>
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
