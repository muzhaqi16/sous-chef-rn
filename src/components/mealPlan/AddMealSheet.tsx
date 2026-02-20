import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, { BottomSheetBackdropProps, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { Icon } from '#utils/iconUtils';
import { MealType } from '#generated';
import { useSavedRecipes } from '#hooks/recipe/useSavedRecipes';
import { CachedImage } from '#components/atoms/CachedImage';

export interface AddMealSheetRef {
  open: (mealType?: MealType) => void;
  close: () => void;
}

interface AddMealSheetProps {
  selectedDate: Date;
  onAddRecipe: (recipeId: string, mealType: MealType) => void;
  onAddCustomMeal: (name: string, mealType: MealType) => void;
}

const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: MealType.Breakfast, label: 'Breakfast' },
  { type: MealType.Brunch, label: 'Brunch' },
  { type: MealType.Lunch, label: 'Lunch' },
  { type: MealType.Snack, label: 'Snack' },
  { type: MealType.Dinner, label: 'Dinner' },
  { type: MealType.Dessert, label: 'Dessert' },
];

export const AddMealSheet = forwardRef<AddMealSheetRef, AddMealSheetProps>(
  ({ selectedDate: _selectedDate, onAddRecipe, onAddCustomMeal: _onAddCustomMeal }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [selectedMealType, setSelectedMealType] = useState<MealType>(MealType.Dinner);
    const [searchQuery, setSearchQuery] = useState('');
    const { recipes } = useSavedRecipes();

    useImperativeHandle(ref, () => ({
      open: (mealType?: MealType) => {
        if (mealType) setSelectedMealType(mealType);
        setSearchQuery('');
        bottomSheetRef.current?.expand();
      },
      close: () => bottomSheetRef.current?.close(),
    }));

    const filteredRecipes = useMemo(() => {
      if (!searchQuery.trim()) return recipes;
      const query = searchQuery.toLowerCase();
      return recipes.filter(r => r.name?.toLowerCase().includes(query));
    }, [recipes, searchQuery]);

    const handleSelectRecipe = useCallback(
      (recipeId: string) => {
        onAddRecipe(recipeId, selectedMealType);
        bottomSheetRef.current?.close();
      },
      [onAddRecipe, selectedMealType],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['80%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add a meal</Text>
        </View>

        {/* Meal type selector */}
        <View style={styles.mealTypeRow}>
          {MEAL_TYPES.map(({ type, label }) => (
            <Pressable
              key={type}
              onPress={() => setSelectedMealType(type)}
              style={[
                styles.mealTypeChip,
                selectedMealType === type && styles.mealTypeChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.mealTypeText,
                  selectedMealType === type && styles.mealTypeTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color={styles.searchIcon.color} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your recipes..."
            placeholderTextColor={styles.searchPlaceholder.color}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Recipe list */}
        <BottomSheetScrollView contentContainerStyle={styles.listContent}>
          {filteredRecipes.map(recipe => (
            <Pressable
              key={recipe.recipeId}
              onPress={() => handleSelectRecipe(recipe.recipeId)}
              style={({ pressed }) => [styles.recipeItem, pressed && styles.pressed]}
            >
              {recipe.imageUrl && (
                <CachedImage uri={recipe.imageUrl} style={styles.recipeImage} />
              )}
              <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={1}>{recipe.name}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.servings} servings
                  {recipe.totalTimeMinutes ? ` \u00B7 ${recipe.totalTimeMinutes} min` : ''}
                </Text>
              </View>
              <Icon name="add-circle-outline" size={24} color={styles.addIcon.color} />
            </Pressable>
          ))}

          {filteredRecipes.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No recipes match your search' : 'No saved recipes yet'}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

AddMealSheet.displayName = 'AddMealSheet';

const styles = StyleSheet.create(theme => ({
  handleIndicator: {
    backgroundColor: theme.colors.textTertiary,
  },
  sheetBackground: {
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  mealTypeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mealTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  mealTypeText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  mealTypeTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    color: theme.colors.textTertiary,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  searchPlaceholder: {
    color: theme.colors.textTertiary,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  recipeImage: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  recipeMeta: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  emptyState: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
}));
