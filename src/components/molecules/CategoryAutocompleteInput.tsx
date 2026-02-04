import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAutocompleteCategoriesLazyQuery, CategorySuggestion, CategoryType } from '#generated';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetAutocompleteInput } from './BottomSheetAutocompleteInput';
import { useAutocompleteInput } from '#hooks/ui/useAutocompleteInput';
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
  const isOnline = useStore(state => state.isOnline);
  const [searchCategories, { data: categoriesData, loading: categoriesLoading }] =
    useAutocompleteCategoriesLazyQuery();

  // Use the shared autocomplete hook for debouncing and state management
  const {
    inputValue,
    handleTextChange: hookHandleTextChange,
    shouldSearch,
  } = useAutocompleteInput<CategorySuggestion>({
    minChars: 2,
    debounceMs: 300,
    onChangeText: useCallback((text: string) => {
      // Skip API call when offline
      if (!isOnline) return;
      // This is called after debounce - trigger the GraphQL query
      searchCategories({
        variables: {
          input: {
            query: text,
            limit: 5,
            type: categoryType
          }
        }
      });
    }, [searchCategories, categoryType, isOnline]),
    getDisplayValue: (item) => item.name,
  });

  // Get categories from query data
  const categories = useMemo(() => {
    if (!shouldSearch) return [];
    return (categoriesData?.autocompleteCategories?.suggestions || []) as CategorySuggestion[];
  }, [categoriesData, shouldSearch]);

  const handleTextChange = (text: string) => {
    onChangeText(text);
    hookHandleTextChange(text);
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
      emptySubtext={`Continue typing to use "${inputValue}" as a custom category`}
      onSearchChange={hookHandleTextChange}
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