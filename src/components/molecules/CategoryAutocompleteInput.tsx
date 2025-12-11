import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAutocompleteCategoriesLazyQuery, CategorySuggestion, CategoryType } from '#generated';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAutocompleteInput } from '#hooks';

interface CategoryAutocompleteInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onCategorySelected?: (categoryId: string | null) => void;
  categoryType?: CategoryType;
}

export const CategoryAutocompleteInput: React.FC<CategoryAutocompleteInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  error,
  onCategorySelected,
  categoryType = CategoryType.General,
}) => {
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);

  const {
    searchTerm,
    debouncedSearchTerm,
    canSearch,
    handleTextChange,
    handleSelectItem,
    setSearchTerm,
  } = useAutocompleteInput<CategorySuggestion>({
    onChangeText,
    onItemSelected: onCategorySelected,
    getDisplayValue: (item) => item.name,
  });

  const [searchCategories, { data: categoriesData, loading: categoriesLoading }] =
    useAutocompleteCategoriesLazyQuery();

  useEffect(() => {
    if (canSearch) {
      searchCategories({
        variables: {
          input: {
            query: debouncedSearchTerm,
            limit: 5,
            type: categoryType
          }
        }
      });
    }
  }, [debouncedSearchTerm, canSearch, searchCategories, categoryType]);

  // Update categories when data changes
  useEffect(() => {
    if (categoriesData?.autocompleteCategories?.suggestions) {
      setCategories(categoriesData.autocompleteCategories.suggestions as CategorySuggestion[]);
    } else if (searchTerm.length < 2) {
      setCategories([]);
    }
  }, [categoriesData, searchTerm]);

  const renderCategoryItem = (category: CategorySuggestion) => (
    <TouchableOpacity
      onPress={() => handleSelectItem(category)}
      style={styles.categoryItem}
      activeOpacity={0.7}>
      <View style={styles.categoryContent}>
        {category.icon && (
          <Text style={styles.categoryIcon}>{category.icon}</Text>
        )}
        <View style={styles.categoryDetails}>
          <Text style={styles.categoryName}>{category.name}</Text>
        </View>
      </View>
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
      title="Select a category"
      searchPlaceholder="Type to search categories..."
      data={categories}
      loading={categoriesLoading}
      renderItem={renderCategoryItem}
      keyExtractor={(item: CategorySuggestion) => item.id}
      onSelectItem={handleSelectItem}
      emptyText="No categories found"
      emptySubtext={`Continue typing to use "${searchTerm}" as a custom category`}
      onSearchChange={setSearchTerm}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  categoryItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  categoryIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs / 2,
  },
}));
