import React, { useState, type RefObject } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { Icon } from '#/utils/iconUtils';
import type { RecipeFilters } from '#/hooks/recipe/useRecipeScreen';

// ── Filter options — synced with DietaryRestrictionSelector + Spoonacular API values ──

const DIET_OPTIONS = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Gluten Free', value: 'gluten free' },
  { label: 'Ketogenic', value: 'ketogenic' },
  { label: 'Paleo', value: 'paleo' },
  { label: 'Pescetarian', value: 'pescetarian' },
  { label: 'Lacto-Vegetarian', value: 'lacto-vegetarian' },
  { label: 'Ovo-Vegetarian', value: 'ovo-vegetarian' },
  { label: 'Primal', value: 'primal' },
  { label: 'Low FODMAP', value: 'low fodmap' },
  { label: 'Whole30', value: 'whole30' },
];

const INTOLERANCE_OPTIONS = [
  { label: 'Dairy', value: 'dairy' },
  { label: 'Egg', value: 'egg' },
  { label: 'Gluten', value: 'gluten' },
  { label: 'Grain', value: 'grain' },
  { label: 'Peanut', value: 'peanut' },
  { label: 'Seafood', value: 'seafood' },
  { label: 'Sesame', value: 'sesame' },
  { label: 'Shellfish', value: 'shellfish' },
  { label: 'Soy', value: 'soy' },
  { label: 'Sulfite', value: 'sulfite' },
  { label: 'Tree Nut', value: 'tree nut' },
  { label: 'Wheat', value: 'wheat' },
  { label: 'Fish', value: 'fish' },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

const COOK_TIMES = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

// ── Props ──

const DEFAULT_FILTERS: RecipeFilters = {
  diet: [],
  intolerances: [],
  mealType: null,
  maxReadyTime: null,
};

interface RecipeFilterSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  activeFilters: RecipeFilters;
  setActiveFilters: React.Dispatch<React.SetStateAction<RecipeFilters>>;
  onSheetChange: (index: number) => void;
}

// ── Component ──

export const RecipeFilterSheet: React.FC<RecipeFilterSheetProps> = ({
  sheetRef,
  activeFilters,
  setActiveFilters,
  onSheetChange,
}) => {
  const { theme } = useUnistyles();

  // Lazy mount: don't render filter content until sheet opens for the first time
  const [mounted, setMounted] = useState(false);

  // Local draft state — chip toggles stay local, committed only on sheet close
  const [draftFilters, setDraftFilters] =
    useState<RecipeFilters>(activeFilters);

  const handleChange = (index: number) => {
    if (index >= 0) {
      // Sheet opening — sync draft from parent's committed filters
      if (!mounted) setMounted(true);
      setDraftFilters(activeFilters);
    } else {
      // Sheet closing — commit draft to parent (single state update)
      setActiveFilters(draftFilters);
    }
    onSheetChange(index);
  };

  return (
    <BottomSheetAction
      sheetRef={sheetRef}
      sheetTitle="Filters"
      snapPoints={['75%', '90%']}
      onChange={handleChange}
      headerRight={
        <View style={styles.filterHeaderActions}>
          <Pressable
            onPress={() => setDraftFilters(DEFAULT_FILTERS)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.filterHeaderClearText}>Clear</Text>
          </Pressable>
          <Pressable
            onPress={() => sheetRef.current?.close()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Icon
              name="checkmark-circle"
              size={24}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>
      }
    >
      {mounted ? (
        <>
          {/* Diet Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Diet</Text>
            <Text style={styles.filterSectionSubtitle}>
              Select all that apply
            </Text>
            <View style={styles.chipRow}>
              {DIET_OPTIONS.map(diet => {
                const isSelected = draftFilters.diet.includes(diet.value);
                return (
                  <Pressable
                    key={diet.value}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      setDraftFilters(prev => ({
                        ...prev,
                        diet: isSelected
                          ? prev.diet.filter(d => d !== diet.value)
                          : [...prev.diet, diet.value],
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {diet.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Intolerances Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Allergies & Intolerances
            </Text>
            <Text style={styles.filterSectionSubtitle}>
              Select all that apply
            </Text>
            <View style={styles.checkboxGrid}>
              {INTOLERANCE_OPTIONS.map(intolerance => {
                const isSelected = draftFilters.intolerances.includes(
                  intolerance.value,
                );
                return (
                  <Pressable
                    key={intolerance.value}
                    style={({ pressed }) => [
                      styles.checkboxItem,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      setDraftFilters(prev => ({
                        ...prev,
                        intolerances: isSelected
                          ? prev.intolerances.filter(
                              i => i !== intolerance.value,
                            )
                          : [...prev.intolerances, intolerance.value],
                      }))
                    }
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                    <Text style={styles.checkboxText}>{intolerance.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Meal Type Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Meal Type</Text>
            <Text style={styles.filterSectionSubtitle}>Select one</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={({ pressed }) => [
                    styles.filterChip,
                    draftFilters.mealType === type.toLowerCase() &&
                      styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setDraftFilters(prev => ({
                      ...prev,
                      mealType:
                        prev.mealType === type.toLowerCase()
                          ? null
                          : type.toLowerCase(),
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      draftFilters.mealType === type.toLowerCase() &&
                        styles.filterChipTextActive,
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
            <Text style={styles.filterSectionTitle}>Max Cook Time</Text>
            <Text style={styles.filterSectionSubtitle}>Select one</Text>
            <View style={styles.chipRow}>
              {COOK_TIMES.map(time => (
                <Pressable
                  key={time.value}
                  style={({ pressed }) => [
                    styles.filterChip,
                    draftFilters.maxReadyTime === time.value &&
                      styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setDraftFilters(prev => ({
                      ...prev,
                      maxReadyTime:
                        prev.maxReadyTime === time.value ? null : time.value,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      draftFilters.maxReadyTime === time.value &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {time.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </BottomSheetAction>
  );
};

const styles = StyleSheet.create(theme => ({
  filterSection: { marginBottom: theme.spacing.xl },
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
    justifyContent: 'flex-start',
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
  filterChipTextActive: { color: theme.colors.white },
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
  filterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  filterHeaderClearText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
