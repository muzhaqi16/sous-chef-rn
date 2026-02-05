import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchBrandsLazyQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { InlineAutocomplete } from './InlineAutocomplete';

interface SuggestedBrand {
  id: string;
  name: string;
}

interface InlineBrandAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onBrandSelected?: (brandId: string | null, brandName: string | null) => void;
  suggestedBrands?: SuggestedBrand[];
  testID?: string;
}

/**
 * InlineBrandAutocomplete - Brand autocomplete that works inside bottom sheets.
 * Shows suggestions in a dropdown below the input instead of opening a nested modal.
 */
export const InlineBrandAutocomplete: React.FC<InlineBrandAutocompleteProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onBrandSelected,
  suggestedBrands = [],
  testID,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isOnline = useAppStore(state => state.isOnline);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [searchBrands, { data: brandsData, loading }] = useSearchBrandsLazyQuery();

  // Filter suggested brands by search term
  const filteredSuggestedBrands = useMemo(() => {
    if (searchTerm.length < 1) {
      return suggestedBrands;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return suggestedBrands.filter(b =>
      b.name.toLowerCase().includes(lowerSearch),
    );
  }, [suggestedBrands, searchTerm]);

  // Debounced API search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Only search API when:
    // 1. Search term is at least 2 chars
    // 2. Online
    // 3. No matching suggested brands
    const shouldSearchApi =
      searchTerm.length >= 2 &&
      isOnline &&
      filteredSuggestedBrands.length === 0;

    if (shouldSearchApi) {
      debounceTimerRef.current = setTimeout(() => {
        searchBrands({
          variables: { search: searchTerm, limit: 10 },
        });
      }, 300);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [searchTerm, searchBrands, isOnline, filteredSuggestedBrands.length]);

  // Combine suggested and searched brands
  const brands = useMemo((): SuggestedBrand[] => {
    // Show suggested brands first
    if (filteredSuggestedBrands.length > 0) {
      return filteredSuggestedBrands;
    }

    // Fall back to API results
    const searchedBrands = brandsData?.brands || [];
    return searchedBrands.map(b => ({ id: b.id, name: b.name }));
  }, [filteredSuggestedBrands, brandsData?.brands]);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear brand selection when user types manually
    onBrandSelected?.(null, null);
  }, [onChangeText, onBrandSelected]);

  const handleSelectBrand = useCallback((brand: SuggestedBrand) => {
    onChangeText(brand.name);
    onBrandSelected?.(brand.id, brand.name);
    setSearchTerm('');
  }, [onChangeText, onBrandSelected]);

  const renderBrandItem = useCallback((item: SuggestedBrand) => {
    const isSuggested = suggestedBrands.some(b => b.id === item.id);

    return (
      <View style={[styles.brandOption, isSuggested && styles.suggestedOption]}>
        <Text style={styles.brandName}>{item.name}</Text>
        {isSuggested && (
          <Text style={styles.suggestedBadge}>Suggested</Text>
        )}
      </View>
    );
  }, [suggestedBrands]);

  const keyExtractor = useCallback((item: SuggestedBrand) => item.id, []);

  return (
    <InlineAutocomplete<SuggestedBrand>
      label={label}
      value={value}
      onChangeText={handleTextChange}
      placeholder={placeholder}
      required={required}
      error={error}
      testID={testID}
      items={brands}
      loading={loading}
      minSearchLength={1}
      maxResults={6}
      renderItem={renderBrandItem}
      keyExtractor={keyExtractor}
      onSelect={handleSelectBrand}
      autoCapitalize="words"
    />
  );
};

const styles = StyleSheet.create(theme => ({
  brandOption: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestedOption: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  brandName: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  suggestedBadge: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
  },
}));
