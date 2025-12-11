import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAutocompleteInput } from '#hooks';
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
  const {
    searchTerm,
    debouncedSearchTerm,
    canSearch,
    handleTextChange,
    handleSelectItem,
    setSearchTerm,
  } = useAutocompleteInput<ItemSuggestion>({
    debounceMs: 250,
    onChangeText,
    getDisplayValue: (item) => item.name,
  });

  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (canSearch) {
      fetchItems({
        variables: { input: { query: debouncedSearchTerm } },
      });
    }
  }, [debouncedSearchTerm, canSearch, fetchItems]);

  const items = data?.autocompleteItems?.suggestions || [];

  const handleSelect = (item: ItemSuggestion) => {
    handleSelectItem(item);
    onSelectItem?.(item);
  };

  const renderItemOption = (item: ItemSuggestion) => {
    const imageUrl = getItemImageUrl(item);

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
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
      onSelectItem={handleSelect}
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
