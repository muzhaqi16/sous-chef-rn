import React, { useCallback, useMemo } from 'react';
import { View, Image, FlatList, Text, TouchableOpacity } from 'react-native';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import {
  ListTemplate,
  SearchBarAction,
  HeaderAction,
  BottomSheetAction,
} from '#components';
import { ItemList } from '#components/organisms/ItemList';
import { RecipeCardSkeleton } from '#components/base/Skeleton';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useRecipeSearch } from './useRecipeSearch';

const INGREDIENT_ITEM_HEIGHT = 56;

const IngredientItem = React.memo(
  ({
    name,
    selected,
    onToggle,
    primaryColor,
    textSecondary,
  }: {
    name: string;
    selected: boolean;
    onToggle: (name: string) => void;
    primaryColor: string;
    textSecondary: string;
  }) => {
    const handlePress = useCallback(() => onToggle(name), [name, onToggle]);

    return (
      <TouchableOpacity style={styles.ingredientItem} onPress={handlePress}>
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? primaryColor : textSecondary}
        />
        <Text style={styles.ingredientText}>{name}</Text>
      </TouchableOpacity>
    );
  },
);
IngredientItem.displayName = 'IngredientItem';

const RecipeSearchContent: React.FC<{
  items: any[];
  loading?: boolean;
  searchPerformed?: boolean;
  onItemPress: (id: string) => void;
  onRefresh?: () => Promise<void>;
  emptyState?: any;
}> = ({ items, loading, searchPerformed, onItemPress, onRefresh, emptyState }) => {
  if (loading && searchPerformed) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3, 4, 5].map(key => (
          <RecipeCardSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  return (
    <ItemList
      items={items}
      onItemPress={onItemPress}
      onRefresh={onRefresh}
      emptyState={emptyState}
    />
  );
};

export const RecipeSearch: React.FC = () => {
  const { theme } = useUnistyles();
  const {
    navigate,
    searchQuery,
    setSearchQuery,
    loading,
    searchPerformed,
    selectedIngredients,
    activeFilters,
    setActiveFilters,
    ingredientSheetRef,
    filterSheetRef,
    pantryItems,
    handleTextSearch,
    handleIngredientSearch,
    openIngredientSelector,
    toggleIngredient,
    openFilterSheet,
    clearFilters,
    applyFilters,
    activeFilterCount,
    items,
    handleItemPress,
  } = useRecipeSearch();

  const ingredientKeyExtractor = useCallback((item: any) => item.id, []);

  const renderIngredientItem = useCallback(
    ({ item }: { item: any }) => {
      const itemName = item.item?.name || item.itemName || '';
      return (
        <IngredientItem
          name={itemName}
          selected={selectedIngredients.has(itemName)}
          onToggle={toggleIngredient}
          primaryColor={theme.colors.primary}
          textSecondary={theme.colors.textSecondary}
        />
      );
    },
    [selectedIngredients, toggleIngredient, theme.colors.primary, theme.colors.textSecondary],
  );

  // Transform items to add leftElement
  const displayItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      leftElement: item.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.imageUrl }} style={styles.leftImage} />
        </View>
      ) : undefined,
    }));
  }, [items]);

  const headerActions = useMemo(
    () => ({
      left: [{ icon: 'arrow-back', onPress: () => navigate('RecipeMain') }] as HeaderAction[],
      right: [] as HeaderAction[],
    }),
    [navigate],
  );

  const searchBarActions = useMemo(
    () => ({
      left: [] as SearchBarAction[],
      right: [
        {
          icon: 'restaurant',
          onPress: openIngredientSelector,
          color: theme.colors.white,
          badge: selectedIngredients.size > 0 ? String(selectedIngredients.size) : undefined,
        },
        {
          icon: 'options',
          onPress: openFilterSheet,
          color: theme.colors.white,
          badge: activeFilterCount > 0 ? String(activeFilterCount) : undefined,
        },
        {
          icon: 'search',
          onPress: handleTextSearch,
          color: theme.colors.primary,
          backgroundColor: theme.colors.surface,
        },
      ] as SearchBarAction[],
    }),
    [handleTextSearch, openIngredientSelector, openFilterSheet, selectedIngredients.size, activeFilterCount, theme],
  );

  const emptyStateConfig = searchPerformed
    ? {
        icon: 'search-off',
        title: 'No recipes found',
        description: 'Try a different search term or different ingredients',
        action: { label: 'Search by Ingredients', onPress: openIngredientSelector },
      }
    : {
        icon: 'search',
        title: 'Search for Recipes',
        description: 'Enter a search term or select pantry ingredients',
        action: { label: 'Search by Ingredients', onPress: openIngredientSelector },
      };

  return (
    <View style={styles.container} testID="recipe-search-screen">
      <ListTemplate
        title="Search Recipes"
        subtitle="Find recipes"
        items={displayItems}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemPress={handleItemPress}
        loading={loading}
        hasNoData={false}
        showHeader={true}
        showSearchBar={true}
        headerActions={headerActions}
        searchBarActions={searchBarActions}
        emptyState={emptyStateConfig}
        customListComponent={RecipeSearchContent}
        customListProps={{ loading, searchPerformed }}
        showUserHeader={false}
      />

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSheetRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
        scrollable={false}
        headerRight={
          <TouchableOpacity
            style={[
              styles.headerSearchButton,
              { backgroundColor: theme.colors.primary },
              selectedIngredients.size === 0 && styles.headerSearchButtonDisabled,
            ]}
            onPress={handleIngredientSearch}
            disabled={selectedIngredients.size === 0}
          >
            <Text style={styles.headerSearchButtonText}>Search ({selectedIngredients.size})</Text>
          </TouchableOpacity>
        }
      >
        <FlatList
          data={pantryItems}
          keyExtractor={ingredientKeyExtractor}
          renderItem={renderIngredientItem}
          getItemLayout={(_data, index) => ({
            length: INGREDIENT_ITEM_HEIGHT,
            offset: INGREDIENT_ITEM_HEIGHT * index,
            index,
          })}
          style={styles.ingredientList}
          contentContainerStyle={styles.ingredientListContent}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.emptyText}>No pantry items available</Text>}
        />
      </BottomSheetAction>

      {/* Filter Bottom Sheet */}
      <BottomSheetAction sheetRef={filterSheetRef} sheetTitle="Filters" snapPoints={['75%', '90%']}>
        {/* Diet Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>🍽️ Diet</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {['Vegan', 'Vegetarian', 'Keto', 'Paleo', 'Whole30'].map(diet => (
              <TouchableOpacity
                key={diet}
                style={[styles.filterChip, activeFilters.diet === diet.toLowerCase() && styles.filterChipActive]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    diet: prev.diet === diet.toLowerCase() ? null : diet.toLowerCase(),
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.diet === diet.toLowerCase() && styles.filterChipTextActive,
                  ]}
                >
                  {diet}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Intolerances Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>⚠️ Allergies & Intolerances</Text>
          <Text style={styles.filterSectionSubtitle}>Select all that apply</Text>
          <View style={styles.checkboxGrid}>
            {['Gluten', 'Dairy', 'Egg', 'Peanut', 'Tree Nut', 'Soy', 'Shellfish', 'Seafood'].map(intolerance => {
              const isSelected = activeFilters.intolerances.includes(intolerance.toLowerCase());
              return (
                <TouchableOpacity
                  key={intolerance}
                  style={styles.checkboxItem}
                  onPress={() =>
                    setActiveFilters(prev => ({
                      ...prev,
                      intolerances: isSelected
                        ? prev.intolerances.filter(i => i !== intolerance.toLowerCase())
                        : [...prev.intolerances, intolerance.toLowerCase()],
                    }))
                  }
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={styles.checkboxText}>{intolerance}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Meal Type Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>🍳 Meal Type</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, activeFilters.mealType === type.toLowerCase() && styles.filterChipActive]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    mealType: prev.mealType === type.toLowerCase() ? null : type.toLowerCase(),
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.mealType === type.toLowerCase() && styles.filterChipTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Max Cook Time Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>⏱️ Max Cook Time</Text>
          <Text style={styles.filterSectionSubtitle}>Select one</Text>
          <View style={styles.chipRow}>
            {[
              { label: '15 min', value: 15 },
              { label: '30 min', value: 30 },
              { label: '45 min', value: 45 },
              { label: '60 min', value: 60 },
            ].map(time => (
              <TouchableOpacity
                key={time.value}
                style={[styles.filterChip, activeFilters.maxReadyTime === time.value && styles.filterChipActive]}
                onPress={() =>
                  setActiveFilters(prev => ({
                    ...prev,
                    maxReadyTime: prev.maxReadyTime === time.value ? null : time.value,
                  }))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.maxReadyTime === time.value && styles.filterChipTextActive,
                  ]}
                >
                  {time.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.filterActions}>
          <TouchableOpacity style={[styles.filterActionButton, styles.clearButton]} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterActionButton, styles.applyButton, { backgroundColor: theme.colors.primary }]}
            onPress={applyFilters}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetAction>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  leftImage: {
    width: theme.sizes.listImage.width,
    height: theme.sizes.listImage.height,
    borderRadius: theme.radii.md,
    resizeMode: 'cover',
    elevation: 2,
  },
  ingredientList: {
    flex: 1,
  },
  ingredientListContent: {
    paddingBottom: theme.spacing.xl,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientText: {
    marginLeft: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  headerSearchButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
  },
  headerSearchButtonDisabled: {
    opacity: 0.5,
  },
  headerSearchButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: theme.spacing.xl,
  },
  filterSectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  filterSectionSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
  },
  checkboxText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
  },
  filterActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  filterActionButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  applyButton: {},
  applyButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
}));
