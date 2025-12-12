import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAutocompleteCategoriesLazyQuery, CategorySuggestion, CategoryType } from '#generated';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useStore } from '#store';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);

  // Check online status to prevent queries when offline
  const isOnline = useStore(state => state.isOnline);

  const [searchCategories, { data: categoriesData, loading: categoriesLoading }] =
    useAutocompleteCategoriesLazyQuery();

  useEffect(() => {
    // Only query when online and search term is long enough
    if (searchTerm.length >= 2 && isOnline) {
      searchCategories({
        variables: {
          input: {
            query: searchTerm,
            limit: 5,
            type: categoryType
          }
        }
      });
    }
  }, [searchTerm, searchCategories, categoryType, isOnline]);

  // Update categories when data changes
  useEffect(() => {
    if (categoriesData?.autocompleteCategories?.suggestions) {
      setCategories(categoriesData.autocompleteCategories.suggestions as CategorySuggestion[]);
    } else if (searchTerm.length < 2) {
      setCategories([]);
    }
  }, [categoriesData, searchTerm]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setSearchTerm(text);
    // Clear category selection when user types manually - allows custom input
    onCategorySelected?.(null);
  };

  const handleSelectCategory = (category: CategorySuggestion) => {
    onChangeText(category.name);
    onCategorySelected?.(category.id);
  };

  const renderCategoryItem = (category: CategorySuggestion) => (
    <TouchableOpacity
      onPress={() => handleSelectCategory(category)}
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
      onSelectItem={handleSelectCategory}
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
    fontSize: theme.typography.fontSize.xl,
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