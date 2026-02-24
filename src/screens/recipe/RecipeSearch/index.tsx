import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ListTemplate } from '#components/templates/ListTemplate';
import { SearchBar, type SearchBarAction } from '#components/molecules/SearchBar';
import { Header } from '#components/molecules/Header';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { ItemList } from '#components/organisms/ItemList';
import { RecipeCardSkeleton } from '#components/base/Skeleton/RecipeCardSkeleton';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useRecipeSearch } from './useRecipeSearch';
import { OfflineGate } from '#components/atoms/OfflineGate';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { CachedImage } from '#components/atoms/CachedImage';

const IngredientItem = ({
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
      <Pressable style={({pressed}) => [styles.ingredientItem, pressed && styles.pressed]} onPress={handlePress}>
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? primaryColor : textSecondary}
        />
        <Text style={styles.ingredientText}>{name}</Text>
      </Pressable>
    );
  };
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
      <ScrollView contentContainerStyle={styles.skeletonContainer}>
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
  useScreenTransition('RecipeSearch');
  const { theme } = useUnistyles();
  const {
    goBack,
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
      const itemName = item.itemName || '';
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
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage uri={item.imageUrl} style={commonStyles.listItemImageCompact} />
        </View>
      ) : undefined,
    }));
  }, [items]);

  // Search bar right actions
  const searchBarRightActions = useMemo(
    () =>
      [
        {
          icon: 'restaurant',
          onPress: openIngredientSelector,
          color: selectedIngredients.size > 0 ? theme.colors.white : theme.colors.primary,
          backgroundColor: selectedIngredients.size > 0 ? theme.colors.primary : theme.colors.surface,
          badge: selectedIngredients.size > 0 ? String(selectedIngredients.size) : undefined,
        },
        {
          icon: 'options',
          onPress: openFilterSheet,
          color: activeFilterCount > 0 ? theme.colors.white : theme.colors.primary,
          backgroundColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.surface,
          badge: activeFilterCount > 0 ? String(activeFilterCount) : undefined,
        },
        {
          icon: 'search',
          onPress: handleTextSearch,
          color: theme.colors.primary,
          backgroundColor: theme.colors.surface,
          testID: 'recipe-search-submit',
        },
      ] as SearchBarAction[],
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
      <OfflineGate
        message="Recipe search requires internet"
        description="Connect to the internet to search for recipes from our database."
      >
        <Header
          title="Search Recipes"
          onBack={goBack}
        />
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes..."
            rightActions={searchBarRightActions}
            testID="recipe-search-input"
          />
        </View>
        <ListTemplate
          items={displayItems}
          onItemPress={handleItemPress}
          loading={loading}
          emptyState={emptyStateConfig}
          customListComponent={RecipeSearchContent}
          customListProps={{ loading, searchPerformed }}
        />

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSheetRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
        scrollable={false}
        headerRight={
          <Pressable
            style={({pressed}) => [
              styles.headerSearchButton,
              { backgroundColor: theme.colors.primary },
              selectedIngredients.size === 0 && styles.headerSearchButtonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleIngredientSearch}
            disabled={selectedIngredients.size === 0}
          >
            <Text style={styles.headerSearchButtonText}>Search ({selectedIngredients.size})</Text>
          </Pressable>
        }
      >
        <FlashList
          data={pantryItems}
          keyExtractor={ingredientKeyExtractor}
          renderItem={renderIngredientItem}
          style={styles.ingredientList}
          contentContainerStyle={styles.ingredientListContent}
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
              <Pressable
                key={diet}
                style={({pressed}) => [styles.filterChip, activeFilters.diet === diet.toLowerCase() && styles.filterChipActive, pressed && styles.pressed]}
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
              </Pressable>
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
                <Pressable
                  key={intolerance}
                  style={({pressed}) => [styles.checkboxItem, pressed && styles.pressed]}
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
                </Pressable>
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
              <Pressable
                key={type}
                style={({pressed}) => [styles.filterChip, activeFilters.mealType === type.toLowerCase() && styles.filterChipActive, pressed && styles.pressed]}
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
              </Pressable>
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
              <Pressable
                key={time.value}
                style={({pressed}) => [styles.filterChip, activeFilters.maxReadyTime === time.value && styles.filterChipActive, pressed && styles.pressed]}
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
              </Pressable>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.filterActions}>
          <Pressable style={({pressed}) => [styles.filterActionButton, styles.clearButton, pressed && styles.pressed]} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [styles.filterActionButton, styles.applyButton, { backgroundColor: theme.colors.primary }, pressed && styles.pressed]}
            onPress={applyFilters}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </BottomSheetAction>
      </OfflineGate>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  skeletonContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
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
    opacity: theme.opacity.disabled,
  },
  headerSearchButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
  },
  filterSection: {
    marginBottom: theme.spacing.xl,
  },
  filterSectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
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
    fontWeight: theme.fonts.weight.semibold,
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
    fontWeight: theme.fonts.weight.semibold,
  },
  applyButton: {},
  applyButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
