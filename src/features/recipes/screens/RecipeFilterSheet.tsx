import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { Icon } from '#/utils/iconUtils';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterMaps';
import { Text } from '#components/atoms/Text';
import {
  LIFESTYLE_DIET_OPTIONS,
  CONSTRAINT_DIET_OPTIONS,
  INTOLERANCE_OPTIONS,
  MEAL_TYPES,
  isLifestyleDietValue,
} from '#features/recipes/utils/recipeFilterOptions';

const COOK_TIMES = [15, 30, 45, 60];

// ── Props ──

const DEFAULT_FILTERS: RecipeFilters = {
  diet: [],
  intolerances: [],
  mealType: null,
  maxReadyTime: null,
};

interface RecipeFilterSheetProps {
  visible: boolean;
  /** Close the sheet (parent flips its `visible` state to false). */
  onRequestClose: () => void;
  activeFilters: RecipeFilters;
  setActiveFilters: React.Dispatch<React.SetStateAction<RecipeFilters>>;
  onSheetChange: (index: number) => void;
  isIngredientSearch?: boolean;
}

// ── Component ──

export const RecipeFilterSheet: React.FC<RecipeFilterSheetProps> = ({
  visible,
  onRequestClose,
  activeFilters,
  setActiveFilters,
  onSheetChange,
  isIngredientSearch = false,
}) => {
  const { t } = useTranslation();
  // Lazy mount: don't render filter content until sheet opens for the first time
  const [mounted, setMounted] = useState(false);

  // Local draft state — chip toggles stay local, committed only on sheet close
  const [draftFilters, setDraftFilters] =
    useState<RecipeFilters>(activeFilters);

  const hasDraftChanges =
    draftFilters.diet.length !== activeFilters.diet.length ||
    draftFilters.intolerances.length !== activeFilters.intolerances.length ||
    draftFilters.mealType !== activeFilters.mealType ||
    draftFilters.maxReadyTime !== activeFilters.maxReadyTime ||
    draftFilters.diet.some(d => !activeFilters.diet.includes(d)) ||
    draftFilters.intolerances.some(
      i => !activeFilters.intolerances.includes(i),
    );

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

  // Lifestyle diets are mutually exclusive: selecting one replaces any prior
  // lifestyle pick while preserving the stackable constraint selections.
  const toggleLifestyleDiet = (value: string) => {
    setDraftFilters(prev => {
      const constraints = prev.diet.filter(d => !isLifestyleDietValue(d));
      return {
        ...prev,
        diet: prev.diet.includes(value) ? constraints : [...constraints, value],
      };
    });
  };

  // Constraint diets stack freely (gluten-free + low-FODMAP, on any lifestyle).
  const toggleConstraintDiet = (value: string) => {
    setDraftFilters(prev => ({
      ...prev,
      diet: prev.diet.includes(value)
        ? prev.diet.filter(d => d !== value)
        : [...prev.diet, value],
    }));
  };

  return (
    <BottomSheetAction
      visible={visible}
      sheetTitle={t('recipeFilters.title')}
      snapPoints={['75%', '90%']}
      onChange={handleChange}
      headerRight={
        <View style={styles.filterHeaderActions}>
          <Pressable
            onPress={() => setDraftFilters(DEFAULT_FILTERS)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('recipeFilters.clearAllA11y')}
          >
            <Text size="sm" weight="semibold" tone="secondary">
              {t('labels.clear')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onRequestClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('recipeFilters.applyA11y')}
          >
            <Icon
              name={
                hasDraftChanges
                  ? 'checkmark-circle'
                  : 'checkmark-circle-outline'
              }
              size={24}
              tone="primary"
            />
          </Pressable>
        </View>
      }
    >
      {mounted ? (
        <>
          {isIngredientSearch ? (
            <View style={styles.infoBanner}>
              <View style={styles.infoBannerIconCircle}>
                <Icon name="information-circle" size={16} tone="white" />
              </View>
              <Text size="sm" weight="semibold" style={styles.infoBannerTitle}>
                {t('recipeFilters.infoBanner')}
              </Text>
            </View>
          ) : null}
          <View>
            {/* Diet Filter */}
            <View style={styles.filterSection}>
              <Text size="lg" weight="bold" style={styles.filterSectionTitle}>
                {t('labels.diet')}
              </Text>

              {/* Lifestyle diet — single select (mutually exclusive) */}
              <Text
                size="sm"
                tone="secondary"
                style={styles.filterSectionSubtitle}
              >
                {t('recipeFilters.dietLifestyleLabel')}
              </Text>
              <View style={styles.chipRow}>
                {LIFESTYLE_DIET_OPTIONS.map(diet => {
                  const isSelected = draftFilters.diet.includes(diet.value);
                  return (
                    <AppPressable
                      key={diet.value}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() => toggleLifestyleDiet(diet.value)}
                    >
                      <Text
                        size="sm"
                        weight="semibold"
                        style={
                          isSelected ? styles.filterChipTextActive : undefined
                        }
                      >
                        {t(diet.labelKey)}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>

              {/* Dietary constraints — multi select (stack on any lifestyle) */}
              <Text
                size="sm"
                tone="secondary"
                style={styles.filterSubGroupLabel}
              >
                {t('recipeFilters.dietConstraintsLabel')}
              </Text>
              <View style={styles.chipRow}>
                {CONSTRAINT_DIET_OPTIONS.map(diet => {
                  const isSelected = draftFilters.diet.includes(diet.value);
                  return (
                    <AppPressable
                      key={diet.value}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() => toggleConstraintDiet(diet.value)}
                    >
                      <Text
                        size="sm"
                        weight="semibold"
                        style={
                          isSelected ? styles.filterChipTextActive : undefined
                        }
                      >
                        {t(diet.labelKey)}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
            </View>

            {/* Intolerances Filter */}
            <View style={styles.filterSection}>
              <Text size="lg" weight="bold" style={styles.filterSectionTitle}>
                {t('labels.allergiesIntolerances')}
              </Text>
              <Text
                size="sm"
                tone="secondary"
                style={styles.filterSectionSubtitle}
              >
                {t('recipeFilters.selectAllThatApply')}
              </Text>
              <View style={styles.checkboxGrid}>
                {INTOLERANCE_OPTIONS.map(intolerance => {
                  const isSelected = draftFilters.intolerances.includes(
                    intolerance.value,
                  );
                  return (
                    <AppPressable
                      key={intolerance.value}
                      style={styles.checkboxItem}
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
                      <Icon
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={24}
                        tone={isSelected ? 'primary' : 'textSecondary'}
                      />
                      <Text size="sm" style={styles.checkboxText}>
                        {t(intolerance.labelKey)}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
            </View>

            {/* Meal Type Filter */}
            <View style={styles.filterSection}>
              <Text size="lg" weight="bold" style={styles.filterSectionTitle}>
                {t('labels.mealType')}
              </Text>
              <Text
                size="sm"
                tone="secondary"
                style={styles.filterSectionSubtitle}
              >
                {t('recipeFilters.selectOne')}
              </Text>
              <View style={styles.chipRow}>
                {MEAL_TYPES.map(type => {
                  const isSelected = draftFilters.mealType === type.value;
                  return (
                    <AppPressable
                      key={type.value}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setDraftFilters(prev => ({
                          ...prev,
                          mealType:
                            prev.mealType === type.value ? null : type.value,
                        }))
                      }
                    >
                      <Text
                        size="sm"
                        weight="semibold"
                        style={
                          isSelected ? styles.filterChipTextActive : undefined
                        }
                      >
                        {t(type.labelKey)}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
            </View>

            {/* Max Cook Time Filter */}
            <View style={styles.filterSection}>
              <Text size="lg" weight="bold" style={styles.filterSectionTitle}>
                {t('labels.maxCookTime')}
              </Text>
              <Text
                size="sm"
                tone="secondary"
                style={styles.filterSectionSubtitle}
              >
                {t('recipeFilters.selectOne')}
              </Text>
              <View style={styles.chipRow}>
                {COOK_TIMES.map(minutes => {
                  const isSelected = draftFilters.maxReadyTime === minutes;
                  return (
                    <AppPressable
                      key={minutes}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setDraftFilters(prev => ({
                          ...prev,
                          maxReadyTime:
                            prev.maxReadyTime === minutes ? null : minutes,
                        }))
                      }
                    >
                      <Text
                        size="sm"
                        weight="semibold"
                        style={
                          isSelected ? styles.filterChipTextActive : undefined
                        }
                      >
                        {t('recipeFilters.cookTimeOption', { minutes })}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
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
    marginBottom: theme.spacing.xs,
  },
  filterSectionSubtitle: {
    marginBottom: theme.spacing.md,
  },
  filterSubGroupLabel: {
    marginTop: theme.spacing.md,
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
  filterChipTextActive: { color: theme.colors.onPrimary },
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
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  checkboxText: {
    marginLeft: theme.spacing.sm,
  },
  filterHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '1A',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoBannerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerTitle: {
    flex: 1,
  },
  pressed: { opacity: theme.opacity.pressed },
}));
