import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSearchBrandsLazyQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { Label } from '#components/atoms/Label';

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
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Show suggestions when there are results
  useEffect(() => {
    setShowSuggestions(brands.length > 0 && searchTerm.length >= 1);
  }, [brands.length, searchTerm.length]);

  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear brand selection when user types manually
    onBrandSelected?.(null, null);
  }, [onChangeText, onBrandSelected]);

  const handleSelectBrand = useCallback((brand: SuggestedBrand) => {
    onChangeText(brand.name);
    onBrandSelected?.(brand.id, brand.name);
    setShowSuggestions(false);
    setSearchTerm('');
  }, [onChangeText, onBrandSelected]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow tap on suggestion
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  const renderBrandOption = useCallback(({ item }: { item: SuggestedBrand }) => {
    const isSuggested = suggestedBrands.some(b => b.id === item.id);

    return (
      <TouchableOpacity
        onPress={() => handleSelectBrand(item)}
        style={[styles.brandOption, isSuggested && styles.suggestedOption]}
        activeOpacity={0.7}
      >
        <Text style={styles.brandName}>{item.name}</Text>
        {isSuggested && (
          <Text style={styles.suggestedBadge}>Suggested</Text>
        )}
      </TouchableOpacity>
    );
  }, [handleSelectBrand, suggestedBrands]);

  return (
    <View style={styles.container}>
      {label && <Label required={required}>{label}</Label>}
      <BottomSheetTextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        onBlur={handleBlur}
        autoCapitalize="words"
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
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {brands.slice(0, 6).map((item, index, arr) => (
                <React.Fragment key={item.id}>
                  {renderBrandOption({ item })}
                  {index < arr.length - 1 && <View style={styles.separator} />}
                </React.Fragment>
              ))}
            </ScrollView>
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
    height: 48,
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
    maxHeight: 200,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1000,
  },
  loadingContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
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
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
}));
