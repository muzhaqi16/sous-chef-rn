import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import {
  Diet,
  Intolerance,
  HealthGoal,
  Cuisine,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils/iconUtils';
import { StringArrayManager } from '#/components/organisms/StringArrayManager/StringArrayManager';
import { NumberInputSheet } from '#/components/modals/NumberInputSheet/NumberInputSheet';
import { InfoRow } from '#/components/molecules/InfoRow';

const ThemedInfoRow = withUnistyles(InfoRow, theme => ({
  iconColor: theme.colors.primary,
}));
import { CuisineSelector } from '#features/profile/components/CuisineSelector';
import { DietaryRestrictionSelector } from '#features/profile/components/DietaryRestrictionSelector';
import { CookingPreferencesSheet } from '#/components/modals/CookingPreferencesSheet/CookingPreferencesSheet';
import { MacroTargetsSheet } from '#/components/modals/MacroTargetsSheet/MacroTargetsSheet';
import { Text } from '#components/atoms/Text';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { errorService } from '#/services/errorService';

export const DietaryProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    profile,
    loading,
    updateDietaryProfile,
    addDietaryRestriction,
    removeDietaryRestriction,
  } = useDietaryProfile();

  // State for modals and editing
  const [editingMeals, setEditingMeals] = useState(false);
  const [editingSnacks, setEditingSnacks] = useState(false);

  const handleRemoveRestriction = (id: string) => {
    alertService.alert(
      t('dietary.removeRestrictionTitle'),
      t('dietary.removeRestrictionConfirm'),
      [
        {
          text: t('labels.remove'),
          style: 'destructive',
          onPress: async () => {
            const success = await removeDietaryRestriction(id);
            if (!success) {
              alertService.alert(
                t('labels.error'),
                t('dietary.removeRestrictionFailed'),
              );
            }
          },
        },
        { text: t('labels.cancel'), style: 'cancel' },
      ],
    );
  };

  // Batch add restrictions handler
  const handleAddRestrictions = async (
    restrictions: {
      diet?: Diet;
      intolerance?: Intolerance;
      healthGoal?: HealthGoal;
    }[],
    severity: RestrictionSeverity,
  ) => {
    let allSucceeded = false;
    try {
      // Add all restrictions in sequence
      const results = await Promise.all(
        restrictions.map(restriction =>
          addDietaryRestriction(restriction, severity),
        ),
      );
      // Check if all succeeded
      allSucceeded = results.every(result => result === true);
    } catch (error) {
      // A throw means not all succeeded.
      errorService.reportError(error, {
        operation: 'DietaryProfile.addRestrictions',
      });
    }
    return allSucceeded;
  };

  // Set the single lifestyle diet: add the new diet first, then clear the
  // prior lifestyle row(s) only once the add succeeds (so a failure leaves the
  // existing diet intact). Constraints/intolerances/goals still add via
  // handleAddRestrictions.
  const handleSelectLifestyleDiet = async (
    diet: Diet,
    replaceIds: string[],
  ) => {
    const added = await addDietaryRestriction(
      { diet },
      RestrictionSeverity.Preference,
    );
    if (added) {
      await Promise.all(replaceIds.map(id => removeDietaryRestriction(id)));
    }
    return added;
  };

  // Cooking preferences state
  const [editingCookingPrefs, setEditingCookingPrefs] = useState(false);

  const handleSaveCookingPrefs = async (values: {
    cookingSkillLevel?: string;
    maxPrepTimeMinutes?: number;
    maxCookTimeMinutes?: number;
    budgetPerMeal?: number;
  }) => {
    const success = await updateDietaryProfile(values);
    if (success) {
      setEditingCookingPrefs(false);
    }
    return success;
  };

  // Macro targets state
  const [editingMacros, setEditingMacros] = useState(false);

  const handleSaveMacros = async (values: {
    calorieTarget?: number;
    proteinTarget?: number;
    carbsTarget?: number;
    fatTarget?: number;
  }) => {
    const success = await updateDietaryProfile(values);
    if (success) {
      setEditingMacros(false);
    }
    return success;
  };

  // Cuisine handlers
  const handleAddCuisine = async (cuisine: Cuisine) => {
    const currentCuisines = profile?.preferredCuisines ?? [];
    return await updateDietaryProfile({
      preferredCuisines: [...currentCuisines, cuisine],
    });
  };

  const handleRemoveCuisine = async (cuisine: Cuisine) => {
    const currentCuisines = profile?.preferredCuisines ?? [];
    await updateDietaryProfile({
      preferredCuisines: currentCuisines.filter(c => c !== cuisine),
    });
  };

  // Ingredient handlers
  const handleAddFavoriteIngredient = async (ingredient: string) => {
    return await updateDietaryProfile({
      favoriteIngredients: [
        ...(profile?.favoriteIngredients || []),
        ingredient,
      ],
    });
  };

  const handleRemoveFavoriteIngredient = async (ingredient: string) => {
    await updateDietaryProfile({
      favoriteIngredients: (profile?.favoriteIngredients || []).filter(
        i => i !== ingredient,
      ),
    });
  };

  const handleAddDislikedIngredient = async (ingredient: string) => {
    return await updateDietaryProfile({
      dislikedIngredients: [
        ...(profile?.dislikedIngredients || []),
        ingredient,
      ],
    });
  };

  const handleRemoveDislikedIngredient = async (ingredient: string) => {
    await updateDietaryProfile({
      dislikedIngredients: (profile?.dislikedIngredients || []).filter(
        i => i !== ingredient,
      ),
    });
  };

  // Modal handlers
  const handleOpenMeals = () => setEditingMeals(true);
  const handleCloseMeals = () => setEditingMeals(false);
  const handleOpenSnacks = () => setEditingSnacks(true);
  const handleCloseSnacks = () => setEditingSnacks(false);
  const handleOpenCookingPrefs = () => setEditingCookingPrefs(true);
  const handleCloseCookingPrefs = () => setEditingCookingPrefs(false);
  const handleOpenMacros = () => setEditingMacros(true);
  const handleCloseMacros = () => setEditingMacros(false);

  const handleSaveMeals = async (value: number) => {
    return await updateDietaryProfile({ mealsPerDay: value });
  };

  const handleSaveSnacks = async (value: number) => {
    return await updateDietaryProfile({ snacksPerDay: value });
  };

  // Gate on "nothing to show", not on `loading` — `cache-and-network` reports
  // `loading: true` for the whole network leg on every mount, so a bare
  // `if (loading)` blanks the screen for up to httpLink's 10s abort. Both
  // non-content states stay inside ProfileScreenWrapper, which is what keeps a
  // back button on screen while it waits.
  if (loading && !profile) {
    return (
      <ProfileScreenWrapper title={t('dietary.title')} scrollEnabled={false}>
        <View style={commonStyles.loadingContainer}>
          <Text style={commonStyles.loadingText}>
            {t('dietary.loadingProfile')}
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  if (!profile) {
    return (
      <ProfileScreenWrapper title={t('dietary.title')} scrollEnabled={false}>
        <View style={commonStyles.emptyState}>
          <Text style={commonStyles.emptyStateTitle}>
            {t('dietary.noProfileTitle')}
          </Text>
          <Text style={commonStyles.emptyStateText}>
            {t('dietary.noProfileSubtitle')}
          </Text>
        </View>
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper title={t('dietary.title')}>
      {/* Dietary Restrictions Section */}
      <Animated.View
        entering={FadeIn.duration(TIMING.SLOW)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>{t('dietary.restrictions')}</Text>
        <View style={styles.sectionCard}>
          <DietaryRestrictionSelector
            existingRestrictions={profile.restrictions}
            onAdd={handleAddRestrictions}
            onRemove={handleRemoveRestriction}
            onSelectLifestyleDiet={handleSelectLifestyleDiet}
          />
        </View>
      </Animated.View>
      {/* Food Preferences Section */}
      <Animated.View
        entering={FadeIn.duration(TIMING.SLOW).delay(100)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>
          {t('dietary.foodPreferences')}
        </Text>
        <View style={styles.sectionCard}>
          <CuisineSelector
            selectedCuisines={profile.preferredCuisines}
            onAdd={handleAddCuisine}
            onRemove={handleRemoveCuisine}
          />

          <StringArrayManager
            title={t('dietary.favoriteIngredients')}
            items={profile.favoriteIngredients}
            onAdd={handleAddFavoriteIngredient}
            onRemove={handleRemoveFavoriteIngredient}
            inputPlaceholder={t('dietary.favoriteIngredientsPlaceholder')}
            addButtonLabel={t('dietary.favoriteIngredientsAdd')}
            emptyMessage={t('dietary.favoriteIngredientsEmpty')}
            containerStyle={styles.ingredientsContainer}
          />

          <StringArrayManager
            title={t('dietary.dislikedIngredients')}
            items={profile.dislikedIngredients}
            onAdd={handleAddDislikedIngredient}
            onRemove={handleRemoveDislikedIngredient}
            inputPlaceholder={t('dietary.dislikedIngredientsPlaceholder')}
            addButtonLabel={t('dietary.dislikedIngredientsAdd')}
            emptyMessage={t('dietary.dislikedIngredientsEmpty')}
            containerStyle={styles.ingredientsContainer}
          />
        </View>
      </Animated.View>
      {/* Nutrition Goals Section */}
      <Animated.View
        entering={FadeIn.duration(TIMING.SLOW).delay(200)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>{t('dietary.nutritionGoals')}</Text>
        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={handleOpenMeals}
          >
            <ThemedInfoRow
              label={t('dietary.mealsPerDay')}
              value={profile.mealsPerDay}
              icon="create-outline"
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={handleOpenSnacks}
          >
            <ThemedInfoRow
              label={t('dietary.snacksPerDay')}
              value={profile.snacksPerDay}
              showBorder={false}
              icon="create-outline"
            />
          </Pressable>
        </View>
      </Animated.View>
      {/* Cooking Preferences Section */}
      <Animated.View
        entering={FadeIn.duration(TIMING.SLOW).delay(300)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={commonStyles.subtitle}>
              {t('labels.cookingPreferences')}
            </Text>
            <AppPressable
              onPress={handleOpenCookingPrefs}
              style={styles.editButton}
            >
              <Icon name="create-outline" size={20} tone="primary" />
            </AppPressable>
          </View>
          {!!profile.cookingSkillLevel && (
            <InfoRow
              label={t('dietary.skillLevel')}
              value={profile.cookingSkillLevel}
            />
          )}
          {!!profile.maxPrepTimeMinutes && (
            <InfoRow
              label={t('dietary.maxPrepTime')}
              value={profile.maxPrepTimeMinutes}
              unit={t('dietary.minutes')}
            />
          )}
          {!!profile.maxCookTimeMinutes && (
            <InfoRow
              label={t('labels.maxCookTime')}
              value={profile.maxCookTimeMinutes}
              unit={t('dietary.minutes')}
            />
          )}
          {!!profile.budgetPerMeal && (
            <InfoRow
              label={t('dietary.budgetPerMeal')}
              value={profile.budgetPerMeal}
              formatter={val => formatCurrency(Number(val), DEFAULT_CURRENCY)}
              showBorder={false}
            />
          )}
        </View>
      </Animated.View>
      {/* Macro Targets Section (Advanced) */}
      {!!(
        profile.calorieTarget ||
        profile.proteinTarget ||
        profile.carbsTarget ||
        profile.fatTarget
      ) && (
        <Animated.View
          entering={FadeIn.duration(TIMING.SLOW).delay(400)}
          layout={LinearTransition}
          style={styles.sectionContainer}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={commonStyles.subtitle}>
                {t('dietary.macroTargets')}
              </Text>
              <AppPressable
                onPress={handleOpenMacros}
                style={styles.editButton}
              >
                <Icon name="create-outline" size={20} tone="primary" />
              </AppPressable>
            </View>
            {!!profile.calorieTarget && (
              <InfoRow
                label={t('dietary.dailyCalories')}
                value={profile.calorieTarget}
                unit="kcal"
              />
            )}
            {!!profile.proteinTarget && (
              <InfoRow
                label={t('dietary.protein')}
                value={profile.proteinTarget}
                unit="g"
              />
            )}
            {!!profile.carbsTarget && (
              <InfoRow
                label={t('labels.carbs')}
                value={profile.carbsTarget}
                unit="g"
              />
            )}
            {!!profile.fatTarget && (
              <InfoRow
                label={t('dietary.fat')}
                value={profile.fatTarget}
                unit="g"
                showBorder={false}
              />
            )}
          </View>
        </Animated.View>
      )}
      {/* Nutrition Goals Sheets */}
      <NumberInputSheet
        visible={editingMeals}
        title={t('dietary.mealsPerDayTitle')}
        value={profile.mealsPerDay}
        onSave={handleSaveMeals}
        onClose={handleCloseMeals}
        min={1}
        max={6}
        placeholder={t('dietary.mealsPlaceholder')}
      />
      <NumberInputSheet
        visible={editingSnacks}
        title={t('dietary.snacksPerDayTitle')}
        value={profile.snacksPerDay}
        onSave={handleSaveSnacks}
        onClose={handleCloseSnacks}
        min={0}
        max={5}
        placeholder={t('labels.eG2')}
      />
      {/* Cooking Preferences Sheet */}
      <CookingPreferencesSheet
        visible={editingCookingPrefs}
        onClose={handleCloseCookingPrefs}
        onSave={handleSaveCookingPrefs}
        initialValues={{
          cookingSkillLevel: profile?.cookingSkillLevel,
          maxPrepTimeMinutes: profile?.maxPrepTimeMinutes,
          maxCookTimeMinutes: profile?.maxCookTimeMinutes,
          budgetPerMeal: profile?.budgetPerMeal,
        }}
      />
      {/* Macro Targets Sheet */}
      <MacroTargetsSheet
        visible={editingMacros}
        onClose={handleCloseMacros}
        onSave={handleSaveMacros}
        initialValues={{
          calorieTarget: profile?.calorieTarget,
          proteinTarget: profile?.proteinTarget,
          carbsTarget: profile?.carbsTarget,
          fatTarget: profile?.fatTarget,
        }}
      />
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  editButton: {
    padding: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  ingredientsContainer: {
    marginTop: theme.spacing.md,
  },
}));

export default DietaryProfileScreen;
