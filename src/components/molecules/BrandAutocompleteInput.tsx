import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchBrandsLazyQuery } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
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

type SectionHeader = {
  id: string;
  type: 'header';
  title: string;
};

type ListItem = BrandItem | SectionHeader;

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
  const [searchTerm, setSearchTerm] = useState('');
  const isOnline = useStore(state => state.isOnline);
  const [searchBrands, { data: brandsData }] = useSearchBrandsLazyQuery();

  // Filter suggested brands by search term
  const filteredSuggestedBrands = useMemo(() => {
    if (searchTerm.length < 2) {
      return suggestedBrands;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return suggestedBrands.filter(b =>
      b.name.toLowerCase().includes(lowerSearch),
    );
  }, [suggestedBrands, searchTerm]);

  // Only search API when:
  // 1. Search term is at least 2 chars
  // 2. Online
  // 3. No matching suggested brands OR no suggested brands at all
  useEffect(() => {
    const shouldSearchApi =
      searchTerm.length >= 2 &&
      isOnline &&
      (suggestedBrands.length === 0 || filteredSuggestedBrands.length === 0);

    if (shouldSearchApi) {
      searchBrands({
        variables: { search: searchTerm, limit: 20 },
      });
    }
  }, [
    searchTerm,
    searchBrands,
    isOnline,
    suggestedBrands.length,
    filteredSuggestedBrands.length,
  ]);

  // Combine suggested and searched brands with sections
  const combinedData = useMemo((): ListItem[] => {
    const result: ListItem[] = [];
    const searchedBrands = brandsData?.brands || [];

    // Add suggested brands section if we have matching suggestions
    if (filteredSuggestedBrands.length > 0) {
      result.push({
        id: 'header-suggested',
        type: 'header',
        title: 'Suggested Brands',
      });
      filteredSuggestedBrands.forEach(brand => {
        result.push({ ...brand, isSuggested: true });
      });
    }

    // Only add searched brands if there are no matching suggested brands
    if (
      filteredSuggestedBrands.length === 0 &&
      searchTerm.length >= 2 &&
      searchedBrands.length > 0
    ) {
      // Filter out brands that are already in suggested (shouldn't happen but be safe)
      const suggestedIds = new Set(suggestedBrands.map(b => b.id));
      const uniqueSearched = searchedBrands.filter(b => !suggestedIds.has(b.id));

      if (uniqueSearched.length > 0) {
        result.push({ id: 'header-all', type: 'header', title: 'All Brands' });
        uniqueSearched.forEach(brand => {
          result.push({ ...brand, isSuggested: false });
        });
      }
    }

    return result;
  }, [filteredSuggestedBrands, brandsData?.brands, suggestedBrands, searchTerm]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear brand selection when user types manually
    onBrandSelected?.(null);
  };

  const handleSelectBrand = (item: ListItem) => {
    // Ignore header items
    if ('type' in item && item.type === 'header') {
      return;
    }

    const brand = item as BrandItem;
    onChangeText(brand.name);
    onBrandSelected?.(brand.id);
  };

  const isSectionHeader = (item: ListItem): item is SectionHeader => {
    return 'type' in item && item.type === 'header';
  };

  const renderItem = (item: ListItem) => {
    // Render section header
    if (isSectionHeader(item)) {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }

    const brand = item as BrandItem;
    return (
      <TouchableOpacity
        onPress={() => handleSelectBrand(item)}
        style={[styles.brandItem, brand.isSuggested && styles.suggestedBrandItem]}
        activeOpacity={0.7}
      >
        <Text style={styles.brandName}>{brand.name}</Text>
        {brand.isSuggested && (
          <Text style={styles.suggestedBadge}>For this item</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Determine empty state messaging
  const getEmptySubtext = () => {
    if (suggestedBrands.length > 0 && searchTerm.length < 2) {
      return 'Select a suggested brand or type to search all brands';
    }
    if (searchTerm.length >= 2) {
      return `Continue typing to add "${searchTerm}" as a custom brand`;
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
      renderItem={renderItem}
      keyExtractor={(item: ListItem) => item.id}
      onSelectItem={handleSelectBrand}
      emptyText={
        suggestedBrands.length > 0 ? 'No matching brands' : 'No brands found'
      }
      emptySubtext={getEmptySubtext()}
      onSearchChange={setSearchTerm}
      minSearchLength={suggestedBrands.length > 0 ? 0 : 2}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  brandItem: {
    paddingVertical: theme.spacing.sm,
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
  sectionHeader: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHeaderText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}));
