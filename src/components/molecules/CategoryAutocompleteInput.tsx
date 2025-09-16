import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useAutocompleteCategoriesLazyQuery, CategorySuggestion, CategoryType } from '#generated';
import { StyleSheet } from 'react-native-unistyles';
import { Input } from '#components/base/Input';

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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);

  // Sync searchTerm with external value changes
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const [searchCategories, { data: categoriesData, loading: categoriesLoading }] =
    useAutocompleteCategoriesLazyQuery();

  useEffect(() => {
    if (searchTerm.length >= 2) {
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
  }, [searchTerm, searchCategories, categoryType]);

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

    if (text.length >= 2 && !showAutocomplete) {
      setShowAutocomplete(true);
      bottomSheetRef.current?.present();
    } else if (text.length < 2 && showAutocomplete) {
      setShowAutocomplete(false);
      bottomSheetRef.current?.dismiss();
    }
  };

  const handleBottomSheetTextChange = (text: string) => {
    setSearchTerm(text);
    onChangeText(text);
    // Clear category selection when user types manually in bottom sheet
    onCategorySelected?.(null);
  };

  const handleSelectCategory = (category: CategorySuggestion) => {
    onChangeText(category.name);
    onCategorySelected?.(category.id);
    setShowAutocomplete(false);
    bottomSheetRef.current?.dismiss();
  };

  const handleDismiss = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        enableTouchThrough={false}
        onPress={() => bottomSheetRef.current?.dismiss()}
      />
    ),
    [],
  );

  const renderCategory = ({ item }: { item: CategorySuggestion }) => (
    <TouchableOpacity
      onPress={() => handleSelectCategory(item)}
      style={styles.categoryItem}
      activeOpacity={0.7}>
      <View style={styles.categoryContent}>
        {item.icon && (
          <Text style={styles.categoryIcon}>{item.icon}</Text>
        )}
        <View style={styles.categoryDetails}>
          <Text style={styles.categoryName}>{item.name}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <BottomSheetView style={styles.messageContainer}>
      <Text style={styles.emptyText}>No categories found</Text>
      <Text style={styles.emptySubtext}>s
        Continue typing to use "{searchTerm}" as a custom category
      </Text>
    </BottomSheetView>
  );

  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        required={required}
        error={error}
      />

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['65%', '75%']}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize"
        enablePanDownToClose={true}
        enableContentPanningGesture={false}>
        <View style={styles.autocompleteContainer}>
          <Text style={styles.autocompleteTitle}>Select a category</Text>

          <BottomSheetTextInput
            style={styles.bottomSheetInput}
            value={searchTerm}
            onChangeText={handleBottomSheetTextChange}
            placeholder="Type to search categories..."
            autoFocus={showAutocomplete}
            returnKeyType="search"
          />

          {categoriesLoading ? (
            <BottomSheetView style={styles.messageContainer}>
              <Text style={styles.loadingText}>Loading categories...</Text>
            </BottomSheetView>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={item => item.id}
              renderItem={renderCategory}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty}
            />
          )}
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  autocompleteContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  autocompleteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  bottomSheetInput: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.md,
    fontSize: theme.typography.fontSize.base,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.inputText,
  },
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
  parentCategory: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs / 2,
  },
  itemCount: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  messageContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));