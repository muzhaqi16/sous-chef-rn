import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { ProfileScreenWrapper } from '#components/templates';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import {
  Diet,
  Intolerance,
  HealthGoal,
  Cuisine,
  RestrictionSeverity,
} from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils';
import { StringArrayManager } from '#/components/organisms';
import { NumberInputModal } from '#/components/organisms/modal';
import { InfoRow } from '#/components/molecules/InfoRow';
import { CuisineSelector } from '#/components/organisms/CuisineSelector';
import { DietaryRestrictionSelector } from '#/components/organisms/DietaryRestrictionSelector';
import { CookingPreferencesSheet } from '#/components/modals/CookingPreferencesSheet';
import { MacroTargetsSheet } from '#/components/modals/MacroTargetsSheet';

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

  const handleRemoveRestriction = (id: string) => {
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
      console.error('Error adding restrictions:', error);
      return false;
    }
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
        <Text style={commonStyles.h3}>Dietary Restrictions</Text>
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
        <Text style={commonStyles.h3}>Food Preferences</Text>
        <View style={styles.sectionCard}>
          <CuisineSelector
            selectedCuisines={(profile.preferredCuisines || []) as Cuisine[]}
            onAdd={async (cuisine: Cuisine) => {
              const currentCuisines = (profile.preferredCuisines ||
                []) as Cuisine[];
              return await updateDietaryProfile({
                preferredCuisines: [...currentCuisines, cuisine],
              });
            }}
            onRemove={async (cuisine: Cuisine) => {
              const currentCuisines = (profile.preferredCuisines ||
                []) as Cuisine[];
              await updateDietaryProfile({
                preferredCuisines: currentCuisines.filter(c => c !== cuisine),
              });
            }}
          />

          <StringArrayManager
            title="Favorite Ingredients"
            items={profile.favoriteIngredients}
            onAdd={async ingredient => {
              return await updateDietaryProfile({
                favoriteIngredients: [
                  ...profile.favoriteIngredients,
                  ingredient,
                ],
              });
            }}
            onRemove={async ingredient => {
              await updateDietaryProfile({
                favoriteIngredients: profile.favoriteIngredients.filter(
                  i => i !== ingredient,
                ),
              });
            }}
            inputPlaceholder="e.g., Garlic, Basil, Chicken"
            addButtonLabel="Add Favorite Ingredient"
            emptyMessage="No favorite ingredients added yet"
            chipColor={theme.colors.success + '20'}
            containerStyle={{ marginTop: theme.spacing.md }}
          />

          <StringArrayManager
            title="Disliked Ingredients"
            items={profile.dislikedIngredients}
            onAdd={async ingredient => {
              return await updateDietaryProfile({
                dislikedIngredients: [
                  ...profile.dislikedIngredients,
                  ingredient,
                ],
              });
            }}
            onRemove={async ingredient => {
              await updateDietaryProfile({
                dislikedIngredients: profile.dislikedIngredients.filter(
                  i => i !== ingredient,
                ),
              });
            }}
            inputPlaceholder="e.g., Cilantro, Mushrooms, Olives"
            addButtonLabel="Add Disliked Ingredient"
            emptyMessage="No disliked ingredients added yet"
            chipColor={theme.colors.error + '20'}
            containerStyle={{ marginTop: theme.spacing.md }}
          />
        </View>
      </Animated.View>

      {/* Nutrition Goals Section */}
      <Animated.View
        entering={FadeIn.duration(300).delay(200)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text style={commonStyles.h3}>Nutrition Goals</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity onPress={() => setEditingMeals(true)}>
            <InfoRow label="Meals per day" value={profile.mealsPerDay} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditingSnacks(true)}>
            <InfoRow
              label="Snacks per day"
              value={profile.snacksPerDay}
              showBorder={false}
            />
          </TouchableOpacity>
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
            <Text style={commonStyles.h3}>Cooking Preferences</Text>
            <TouchableOpacity
              onPress={() => setEditingCookingPrefs(true)}
              style={styles.editButton}
            >
              <Icon
                library="Feather"
                name="edit"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
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
              <Text style={commonStyles.h3}>Macro Targets (Advanced)</Text>
              <TouchableOpacity
                onPress={() => setEditingMacros(true)}
                style={styles.editButton}
              >
                <Icon
                  library="Feather"
                  name="edit"
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
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
        onSave={async value => {
          return await updateDietaryProfile({ mealsPerDay: value });
        }}
        onCancel={() => setEditingMeals(false)}
        min={1}
        max={6}
        placeholder="e.g., 3"
      />

      <NumberInputModal
        visible={editingSnacks}
        title="Snacks Per Day"
        value={profile.snacksPerDay}
        onSave={async value => {
          return await updateDietaryProfile({ snacksPerDay: value });
        }}
        onCancel={() => setEditingSnacks(false)}
        min={0}
        max={5}
        placeholder="e.g., 2"
      />

      {/* Cooking Preferences Sheet */}
      <CookingPreferencesSheet
        visible={editingCookingPrefs}
        onClose={() => setEditingCookingPrefs(false)}
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
        onClose={() => setEditingMacros(false)}
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
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
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
}));
