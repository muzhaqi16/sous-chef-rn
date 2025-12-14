import React, { useCallback } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAutocompleteInput } from '#hooks/ui/useAutocompleteInput';
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
  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  // Use the shared autocomplete hook for debouncing and state management
  const {
    inputValue,
    handleTextChange: hookHandleTextChange,
    shouldSearch,
  } = useAutocompleteInput<ItemSuggestion>({
    minChars: 2,
    debounceMs: 250,
    onChangeText: useCallback((text: string) => {
      // This is called after debounce - trigger the GraphQL query
      fetchItems({
        variables: { input: { query: text, limit: 10 } },
      });
    }, [fetchItems]),
    getDisplayValue: (item) => item.name,
  });

  const items = data?.autocompleteItems?.suggestions || [];

  const handleTextChange = (text: string) => {
    onChangeText(text);
    hookHandleTextChange(text);
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
        shouldSearch
          ? `Continue typing to add "${inputValue}"`
          : 'Type at least 2 characters to search'
      }
      onSearchChange={hookHandleTextChange}
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
    fontSize: theme.typography.fontSize.lg,
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
