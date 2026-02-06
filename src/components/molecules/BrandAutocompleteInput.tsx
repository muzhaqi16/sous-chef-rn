import React, { useCallback, useMemo, useRef } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchBrandsLazyQuery } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAutocompleteInput } from '#hooks/ui/useAutocompleteInput';
import { useStore } from '#store';

type BrandItem = {
  id: string;
  name: string;
  isSuggested?: boolean;
};

type SuggestedBrand = {
  id: string;
  name: string;
};

type ListItem = BrandItem;

interface BrandAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onBrandSelected?: (brandId: string | null) => void;
  suggestedBrands?: SuggestedBrand[];
}

export const BrandAutocompleteInput: React.FC<BrandAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onBrandSelected,
  suggestedBrands = [],
}) => {
  const isOnline = useStore(state => state.isOnline);
  const [searchBrands, { data: brandsData, loading: brandsLoading }] = useSearchBrandsLazyQuery();
  const lastSearchedTermRef = useRef('');

  // Use the shared autocomplete hook for debouncing and state management
  const {
    inputValue,
    handleTextChange: hookHandleTextChange,
    shouldSearch,
  } = useAutocompleteInput<BrandItem>({
    minChars: 2,
    debounceMs: 300,
    onChangeText: useCallback((text: string) => {
      if (!isOnline) return;
      lastSearchedTermRef.current = text;
      searchBrands({ variables: { search: text, limit: 20 } });
    }, [searchBrands, isOnline]),
    getDisplayValue: (item) => item.name,
  });

  const combinedData = useMemo((): ListItem[] => {
    const searchedBrands = brandsData?.brands || [];

    // Only show search results if they're relevant to the current input.
    // "abc".startsWith("ab") → true: show "ab" results while "abc" loads (smooth refinement)
    // "xy".startsWith("ab") → false: don't show stale "ab" results for unrelated search
    const resultsAreRelevant = shouldSearch
      && searchedBrands.length > 0
      && inputValue.toLowerCase().startsWith(lastSearchedTermRef.current.toLowerCase());

    if (resultsAreRelevant) {
      return searchedBrands.map(brand => ({ ...brand, isSuggested: false }));
    }

    // Show suggested brands when:
    // - Not searching yet (< 2 chars), OR
    // - Searching but results haven't arrived yet (prevents flicker)
    if (suggestedBrands.length > 0) {
      return suggestedBrands.map(brand => ({ ...brand, isSuggested: true }));
    }

    return [];
  }, [suggestedBrands, brandsData?.brands, shouldSearch, inputValue]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    hookHandleTextChange(text);
    // Clear brand selection when user types manually
    onBrandSelected?.(null);
  };

  const handleSelectBrand = (item: ListItem) => {
    onChangeText(item.name);
    onBrandSelected?.(item.id);
  };

  const renderItem = (item: ListItem) => {
    return (
      <TouchableOpacity
        onPress={() => handleSelectBrand(item)}
        style={[styles.brandItem, item.isSuggested && styles.suggestedBrandItem]}
        activeOpacity={0.7}
      >
        <Text style={styles.brandName}>{item.name}</Text>
        {item.isSuggested && (
          <Text style={styles.suggestedBadge}>For this item</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Determine empty state messaging
  const getEmptySubtext = () => {
    if (suggestedBrands.length > 0 && inputValue.length < 2) {
      return 'Select a suggested brand or type to search all brands';
    }
    if (shouldSearch) {
      return `Continue typing to add "${inputValue}" as a custom brand`;
    }
    return 'Type at least 2 characters to search';
  };

  return (
    <BottomSheetAutocompleteInput
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      title="Select a brand"
      searchPlaceholder="Type to search brands..."
      data={combinedData}
      loading={brandsLoading}
      renderItem={renderItem}
      keyExtractor={(item: ListItem) => item.id}
      onSelectItem={handleSelectBrand}
      emptyText={
        suggestedBrands.length > 0 ? 'No matching brands' : 'No brands found'
      }
      emptySubtext={getEmptySubtext()}
      onSearchChange={hookHandleTextChange}
      minSearchLength={suggestedBrands.length > 0 ? 0 : 2}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  brandItem: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestedBrandItem: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  brandName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  suggestedBadge: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
  },
}));
