import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import {
  Diet,
  Intolerance,
  HealthGoal,
  Cuisine,
  RestrictionSeverity,
} from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils/iconUtils';
import { StringArrayManager } from '#/components/organisms/StringArrayManager/StringArrayManager';
import { NumberInputModal } from '#/components/organisms/modal/NumberInputModal';
import { InfoRow } from '#/components/molecules/InfoRow';
import { CuisineSelector } from '#/components/organisms/CuisineSelector';
import { DietaryRestrictionSelector } from '#/components/organisms/DietaryRestrictionSelector';
import { CookingPreferencesSheet } from '#/components/modals/CookingPreferencesSheet/CookingPreferencesSheet';
import { MacroTargetsSheet } from '#/components/modals/MacroTargetsSheet/MacroTargetsSheet';
import { errorService } from '#/services/errorService';

export const DietaryProfileScreen: React.FC = () => {
  const { theme } = useUnistyles();
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

  const handleRemoveRestriction = useCallback((id: string) => {
    Alert.alert(
      'Remove Restriction',
      'Are you sure you want to remove this dietary restriction?',
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeDietaryRestriction(id);
            if (!success) {
              Alert.alert('Error', 'Failed to remove restriction');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [removeDietaryRestriction]);

  // Batch add restrictions handler
  const handleAddRestrictions = useCallback(async (
    restrictions: {
      diet?: Diet;
      intolerance?: Intolerance;
      healthGoal?: HealthGoal;
    }[],
    severity: RestrictionSeverity,
  ) => {
    try {
      // Add all restrictions in sequence
      const results = await Promise.all(
        restrictions.map(restriction =>
          addDietaryRestriction(restriction, severity),
        ),
      );

      // Check if all succeeded
      return results.every(result => result === true);
    } catch (error) {
      errorService.reportError(error, { operation: 'DietaryProfile.addRestrictions' });
      return false;
    }
  }, [addDietaryRestriction]);

  // Cooking preferences state
  const [editingCookingPrefs, setEditingCookingPrefs] = useState(false);

  const handleSaveCookingPrefs = useCallback(async (values: {
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
  }, [updateDietaryProfile]);

  // Macro targets state
  const [editingMacros, setEditingMacros] = useState(false);

  const handleSaveMacros = useCallback(async (values: {
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
  }, [updateDietaryProfile]);

  // Cuisine handlers
  const handleAddCuisine = useCallback(async (cuisine: Cuisine) => {
    const currentCuisines = (profile?.preferredCuisines || []) as Cuisine[];
    return await updateDietaryProfile({
      preferredCuisines: [...currentCuisines, cuisine],
    });
  }, [profile?.preferredCuisines, updateDietaryProfile]);

  const handleRemoveCuisine = useCallback(async (cuisine: Cuisine) => {
    const currentCuisines = (profile?.preferredCuisines || []) as Cuisine[];
    await updateDietaryProfile({
      preferredCuisines: currentCuisines.filter(c => c !== cuisine),
    });
  }, [profile?.preferredCuisines, updateDietaryProfile]);

  // Ingredient handlers
  const handleAddFavoriteIngredient = useCallback(async (ingredient: string) => {
    return await updateDietaryProfile({
      favoriteIngredients: [...(profile?.favoriteIngredients || []), ingredient],
    });
  }, [profile?.favoriteIngredients, updateDietaryProfile]);

  const handleRemoveFavoriteIngredient = useCallback(async (ingredient: string) => {
    await updateDietaryProfile({
      favoriteIngredients: (profile?.favoriteIngredients || []).filter(
        i => i !== ingredient,
      ),
    });
  }, [profile?.favoriteIngredients, updateDietaryProfile]);

  const handleAddDislikedIngredient = useCallback(async (ingredient: string) => {
    return await updateDietaryProfile({
      dislikedIngredients: [...(profile?.dislikedIngredients || []), ingredient],
    });
  }, [profile?.dislikedIngredients, updateDietaryProfile]);

  const handleRemoveDislikedIngredient = useCallback(async (ingredient: string) => {
    await updateDietaryProfile({
      dislikedIngredients: (profile?.dislikedIngredients || []).filter(
        i => i !== ingredient,
      ),
    });
  }, [profile?.dislikedIngredients, updateDietaryProfile]);

  // Modal handlers
  const handleOpenMeals = useCallback(() => setEditingMeals(true), []);
  const handleCloseMeals = useCallback(() => setEditingMeals(false), []);
  const handleOpenSnacks = useCallback(() => setEditingSnacks(true), []);
  const handleCloseSnacks = useCallback(() => setEditingSnacks(false), []);
  const handleOpenCookingPrefs = useCallback(() => setEditingCookingPrefs(true), []);
  const handleCloseCookingPrefs = useCallback(() => setEditingCookingPrefs(false), []);
  const handleOpenMacros = useCallback(() => setEditingMacros(true), []);
  const handleCloseMacros = useCallback(() => setEditingMacros(false), []);

  const handleSaveMeals = useCallback(async (value: number) => {
    return await updateDietaryProfile({ mealsPerDay: value });
  }, [updateDietaryProfile]);

  const handleSaveSnacks = useCallback(async (value: number) => {
    return await updateDietaryProfile({ snacksPerDay: value });
  }, [updateDietaryProfile]);

  // Memoize container style
  const favoriteContainerStyle = useMemo(() => (
    { marginTop: theme.spacing.md }
  ), [theme.spacing.md]);

  const dislikedContainerStyle = useMemo(() => (
    { marginTop: theme.spacing.md }
  ), [theme.spacing.md]);

  if (loading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <Text style={commonStyles.loadingText}>Loading dietary profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={commonStyles.emptyState}>
        <Text style={commonStyles.emptyStateTitle}>No Dietary Profile</Text>
        <Text style={commonStyles.emptyStateText}>
          Create your dietary profile to get personalized recipe recommendations
        </Text>
      </View>
    );
  }

  return (
    <ProfileScreenWrapper title="Dietary Profile">
      {/* Dietary Restrictions Section */}
      <Animated.View
        entering={FadeIn.duration(300)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>Dietary Restrictions</Text>
        <View style={styles.sectionCard}>
          <DietaryRestrictionSelector
            existingRestrictions={profile.restrictions}
            onAdd={handleAddRestrictions}
            onRemove={handleRemoveRestriction}
          />
        </View>
      </Animated.View>

      {/* Food Preferences Section */}
      <Animated.View
        entering={FadeIn.duration(300).delay(100)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>Food Preferences</Text>
        <View style={styles.sectionCard}>
          <CuisineSelector
            selectedCuisines={(profile.preferredCuisines || []) as Cuisine[]}
            onAdd={handleAddCuisine}
            onRemove={handleRemoveCuisine}
          />

          <StringArrayManager
            title="Favorite Ingredients"
            items={profile.favoriteIngredients}
            onAdd={handleAddFavoriteIngredient}
            onRemove={handleRemoveFavoriteIngredient}
            inputPlaceholder="e.g., Garlic, Basil, Chicken"
            addButtonLabel="Add Favorite Ingredient"
            emptyMessage="No favorite ingredients added yet"
            containerStyle={favoriteContainerStyle}
          />

          <StringArrayManager
            title="Disliked Ingredients"
            items={profile.dislikedIngredients}
            onAdd={handleAddDislikedIngredient}
            onRemove={handleRemoveDislikedIngredient}
            inputPlaceholder="e.g., Cilantro, Mushrooms, Olives"
            addButtonLabel="Add Disliked Ingredient"
            emptyMessage="No disliked ingredients added yet"
            containerStyle={dislikedContainerStyle}
          />
        </View>
      </Animated.View>

      {/* Nutrition Goals Section */}
      <Animated.View
        entering={FadeIn.duration(300).delay(200)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.subtitle}>Nutrition Goals</Text>
        <View style={styles.sectionCard}>
          <Pressable style={({pressed}) => pressed && styles.pressed} onPress={handleOpenMeals}>
            <InfoRow label="Meals per day" value={profile.mealsPerDay} />
          </Pressable>
          <Pressable style={({pressed}) => pressed && styles.pressed} onPress={handleOpenSnacks}>
            <InfoRow
              label="Snacks per day"
              value={profile.snacksPerDay}
              showBorder={false}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* Cooking Preferences Section */}
      <Animated.View
        entering={FadeIn.duration(300).delay(300)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={commonStyles.subtitle}>Cooking Preferences</Text>
            <Pressable
              onPress={handleOpenCookingPrefs}
              style={({pressed}) => [styles.editButton, pressed && styles.pressed]}
            >
              <Icon
                name="create-outline"
                size={20}
                color={theme.colors.primary}
              />
            </Pressable>
          </View>
          {profile.cookingSkillLevel && (
            <InfoRow label="Skill Level" value={profile.cookingSkillLevel} />
          )}
          {profile.maxPrepTimeMinutes && (
            <InfoRow
              label="Max Prep Time"
              value={profile.maxPrepTimeMinutes}
              unit="minutes"
            />
          )}
          {profile.maxCookTimeMinutes && (
            <InfoRow
              label="Max Cook Time"
              value={profile.maxCookTimeMinutes}
              unit="minutes"
            />
          )}
          {profile.budgetPerMeal && (
            <InfoRow
              label="Budget per Meal"
              value={profile.budgetPerMeal}
              formatter={val => `$${val}`}
              showBorder={false}
            />
          )}
        </View>
      </Animated.View>

      {/* Macro Targets Section (Advanced) */}
      {(profile.calorieTarget ||
        profile.proteinTarget ||
        profile.carbsTarget ||
        profile.fatTarget) && (
        <Animated.View
          entering={FadeIn.duration(300).delay(400)}
          layout={LinearTransition}
          style={styles.sectionContainer}
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={commonStyles.subtitle}>Macro Targets (Advanced)</Text>
              <Pressable
                onPress={handleOpenMacros}
                style={({pressed}) => [styles.editButton, pressed && styles.pressed]}
              >
                <Icon
                  name="create-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </Pressable>
            </View>
            {profile.calorieTarget && (
              <InfoRow
                label="Daily Calories"
                value={profile.calorieTarget}
                unit="kcal"
              />
            )}
            {profile.proteinTarget && (
              <InfoRow label="Protein" value={profile.proteinTarget} unit="g" />
            )}
            {profile.carbsTarget && (
              <InfoRow label="Carbs" value={profile.carbsTarget} unit="g" />
            )}
            {profile.fatTarget && (
              <InfoRow
                label="Fat"
                value={profile.fatTarget}
                unit="g"
                showBorder={false}
              />
            )}
          </View>
        </Animated.View>
      )}

      {/* Nutrition Goals Modals */}
      <NumberInputModal
        visible={editingMeals}
        title="Meals Per Day"
        value={profile.mealsPerDay}
        onSave={handleSaveMeals}
        onCancel={handleCloseMeals}
        min={1}
        max={6}
        placeholder="e.g., 3"
      />

      <NumberInputModal
        visible={editingSnacks}
        title="Snacks Per Day"
        value={profile.snacksPerDay}
        onSave={handleSaveSnacks}
        onCancel={handleCloseSnacks}
        min={0}
        max={5}
        placeholder="e.g., 2"
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
    borderWidth: 1,
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
}));

export default DietaryProfileScreen;
