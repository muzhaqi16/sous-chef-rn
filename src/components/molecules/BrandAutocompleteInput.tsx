import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSearchBrandsLazyQuery } from '#generated';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';

type BrandItem = {
  id: string;
  name: string;
};

interface BrandAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onBrandSelected?: (brandId: string | null) => void;
}

export const BrandAutocompleteInput: React.FC<BrandAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onBrandSelected,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBrands, { data: brandsData }] = useSearchBrandsLazyQuery();

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchBrands({
        variables: { search: searchTerm, limit: 20 },
      });
    }
  }, [searchTerm, searchBrands]);

  const brands = brandsData?.brands || [];

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear brand selection when user types manually
    onBrandSelected?.(null);
  };

  const handleSelectBrand = (brand: BrandItem) => {
    onChangeText(brand.name);
    onBrandSelected?.(brand.id);
  };

  const renderBrandItem = (brand: BrandItem) => (
    <TouchableOpacity
      onPress={() => handleSelectBrand(brand)}
      style={styles.brandItem}
      activeOpacity={0.7}
    >
      <Text style={styles.brandName}>{brand.name}</Text>
    </TouchableOpacity>
  );

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
      data={brands}
      renderItem={renderBrandItem}
      keyExtractor={(item: BrandItem) => item.id}
      onSelectItem={handleSelectBrand}
      emptyText="No brands found"
      emptySubtext={`Continue typing to add "${searchTerm}" as a custom brand`}
      onSearchChange={setSearchTerm}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  brandItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  brandName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
}));
