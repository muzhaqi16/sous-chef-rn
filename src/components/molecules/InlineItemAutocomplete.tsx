import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { InlineAutocomplete } from './InlineAutocomplete';

interface InlineItemAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onSelectItem?: (item: ItemSuggestion) => void;
  testID?: string;
}

/**
 * InlineItemAutocomplete - Autocomplete for items that works inside bottom sheets.
 * Shows suggestions in a dropdown below the input instead of opening a nested modal.
 */
export const InlineItemAutocomplete: React.FC<InlineItemAutocompleteProps> = ({
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

  const isOnline = useAppStore(state => state.isOnline);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  // Debounce autocomplete queries
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (searchTerm.length >= 2 && isOnline) {
      debounceTimerRef.current = setTimeout(() => {
        fetchItems({
          variables: { input: { query: searchTerm, limit: 5 } },
        });
      }, 250);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [searchTerm, fetchItems, isOnline]);

  const items = data?.autocompleteItems?.suggestions || [];

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    setSearchTerm(text);
  }, [onChangeText]);

  const handleSelectItem = useCallback((item: ItemSuggestion) => {
    onChangeText(item.name.trim());
    onSelectItem?.(item);
    setSearchTerm('');
  }, [onChangeText, onSelectItem]);

  const renderItemOption = useCallback((item: ItemSuggestion) => {
    const imageUrl = item.imageUrl || null;

    return (
      <View style={styles.itemOption}>
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
            {item.brands && item.brands.length > 0 && (
              <Text style={styles.itemBrand}>{item.brands[0].name}</Text>
            )}
          </View>
        </View>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((item: ItemSuggestion) => item.id, []);

  return (
    <InlineAutocomplete<ItemSuggestion>
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      items={items}
      loading={loading}
      minSearchLength={2}
      maxResults={5}
      renderItem={renderItemOption}
      keyExtractor={keyExtractor}
      onSelect={handleSelectItem}
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
    width: theme.sizes.avatar.sm,
    height: theme.sizes.avatar.sm,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  itemImagePlaceholder: {
    width: theme.sizes.avatar.sm,
    height: theme.sizes.avatar.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: theme.typography.fontSize.md,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  itemBrand: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
