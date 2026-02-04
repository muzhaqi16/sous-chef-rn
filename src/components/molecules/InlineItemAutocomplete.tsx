import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { Label } from '#components/atoms/Label';

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
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Show suggestions when there are results and user is typing
  useEffect(() => {
    setShowSuggestions(items.length > 0 && searchTerm.length >= 2);
  }, [items.length, searchTerm.length]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
  };

  const handleSelectItem = (item: ItemSuggestion) => {
    onChangeText(item.name.trim());
    onSelectItem?.(item);
    setShowSuggestions(false);
    setSearchTerm(''); // Clear search to hide suggestions
  };

  const handleBlur = () => {
    // Delay hiding to allow tap on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const renderItemOption = ({ item }: { item: ItemSuggestion }) => {
    const imageUrl = item.imageUrl || null;

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
            {item.brands && item.brands.length > 0 && (
              <Text style={styles.itemBrand}>{item.brands[0].name}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {label && <Label required={required}>{label}</Label>}
      <BottomSheetTextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        onBlur={handleBlur}
        testID={testID}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={item => item.id}
              renderItem={renderItemOption}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              nestedScrollEnabled={true}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  label: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error,
  },
  input: {
    height: theme.sizes.input.md,
    borderRadius: theme.radii.md,
    fontSize: theme.fonts.size.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    maxHeight: 250,
    zIndex: theme.zIndex.dropdown,
    ...theme.shadows.lg,
  },
  loadingContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
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
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
}));
