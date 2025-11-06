import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
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

  // Cooking preferences handlers
  const [editingCookingPrefs, setEditingCookingPrefs] = useState(false);
  const [tempSkillLevel, setTempSkillLevel] = useState('');
  const [tempPrepTime, setTempPrepTime] = useState('');
  const [tempCookTime, setTempCookTime] = useState('');
  const [tempBudget, setTempBudget] = useState('');

  const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const handleEditCookingPrefs = () => {
    setTempSkillLevel(profile?.cookingSkillLevel || '');
    setTempPrepTime(String(profile?.maxPrepTimeMinutes || ''));
    setTempCookTime(String(profile?.maxCookTimeMinutes || ''));
    setTempBudget(String(profile?.budgetPerMeal || ''));
    setEditingCookingPrefs(true);
  };

  const handleSaveCookingPrefs = async () => {
    const updates: any = {};

    // Validate and add skill level if provided
    if (tempSkillLevel.trim()) {
      updates.cookingSkillLevel = tempSkillLevel.trim();
    }

    // Validate and add prep time if provided
    if (tempPrepTime) {
      const prepTime = parseInt(tempPrepTime);
      if (isNaN(prepTime) || prepTime < 0 || prepTime > 480) {
        Alert.alert(
          'Invalid Input',
          'Prep time must be between 0 and 480 minutes',
        );
        return;
      }
      updates.maxPrepTimeMinutes = prepTime;
    }

    // Validate and add cook time if provided
    if (tempCookTime) {
      const cookTime = parseInt(tempCookTime);
      if (isNaN(cookTime) || cookTime < 0 || cookTime > 480) {
        Alert.alert(
          'Invalid Input',
          'Cook time must be between 0 and 480 minutes',
        );
        return;
      }
      updates.maxCookTimeMinutes = cookTime;
    }

    // Validate and add budget if provided
    if (tempBudget) {
      const budget = parseFloat(tempBudget);
      if (isNaN(budget) || budget < 0 || budget > 1000) {
        Alert.alert('Invalid Input', 'Budget must be between $0 and $1000');
        return;
      }
      updates.budgetPerMeal = budget;
    }

    const success = await updateDietaryProfile(updates);

    if (success) {
      setEditingCookingPrefs(false);
    } else {
      Alert.alert('Error', 'Failed to update cooking preferences');
    }
  };

  // Macro targets handlers
  const [editingMacros, setEditingMacros] = useState(false);
  const [tempCalories, setTempCalories] = useState('');
  const [tempProtein, setTempProtein] = useState('');
  const [tempCarbs, setTempCarbs] = useState('');
  const [tempFat, setTempFat] = useState('');

  const handleEditMacros = () => {
    setTempCalories(String(profile?.calorieTarget || ''));
    setTempProtein(String(profile?.proteinTarget || ''));
    setTempCarbs(String(profile?.carbsTarget || ''));
    setTempFat(String(profile?.fatTarget || ''));
    setEditingMacros(true);
  };

  const handleSaveMacros = async () => {
    const updates: any = {};

    // Validate and add calories if provided
    if (tempCalories) {
      const calories = parseInt(tempCalories);
      if (isNaN(calories) || calories < 0 || calories > 10000) {
        Alert.alert('Invalid Input', 'Calories must be between 0 and 10000');
        return;
      }
      updates.calorieTarget = calories;
    }

    // Validate and add protein if provided
    if (tempProtein) {
      const protein = parseInt(tempProtein);
      if (isNaN(protein) || protein < 0 || protein > 500) {
        Alert.alert('Invalid Input', 'Protein must be between 0 and 500g');
        return;
      }
      updates.proteinTarget = protein;
    }

    // Validate and add carbs if provided
    if (tempCarbs) {
      const carbs = parseInt(tempCarbs);
      if (isNaN(carbs) || carbs < 0 || carbs > 1000) {
        Alert.alert('Invalid Input', 'Carbs must be between 0 and 1000g');
        return;
      }
      updates.carbsTarget = carbs;
    }

    // Validate and add fat if provided
    if (tempFat) {
      const fat = parseInt(tempFat);
      if (isNaN(fat) || fat < 0 || fat > 500) {
        Alert.alert('Invalid Input', 'Fat must be between 0 and 500g');
        return;
      }
      updates.fatTarget = fat;
    }

    const success = await updateDietaryProfile(updates);

    if (success) {
      setEditingMacros(false);
    } else {
      Alert.alert('Error', 'Failed to update macro targets');
    }
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
              onPress={handleEditCookingPrefs}
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
                onPress={handleEditMacros}
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

      {/* Cooking Preferences Edit Modal */}
      <Modal
        visible={editingCookingPrefs}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingCookingPrefs(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[commonStyles.card, styles.modalContent]}>
            <Text style={commonStyles.h3}>Edit Cooking Preferences</Text>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Cooking Skill Level:</Text>
              <TouchableOpacity
                style={[commonStyles.input, styles.pickerButton]}
                onPress={() => {
                  Alert.alert('Select Skill Level', '', [
                    ...SKILL_LEVELS.map(level => ({
                      text: level,
                      onPress: () => setTempSkillLevel(level),
                    })),
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
              >
                <Text style={commonStyles.body}>
                  {tempSkillLevel || 'Select...'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Max Prep Time (minutes):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempPrepTime}
                onChangeText={setTempPrepTime}
                keyboardType="number-pad"
                placeholder="e.g., 30"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Max Cook Time (minutes):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempCookTime}
                onChangeText={setTempCookTime}
                keyboardType="number-pad"
                placeholder="e.g., 60"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Budget per Meal ($):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempBudget}
                onChangeText={setTempBudget}
                keyboardType="decimal-pad"
                placeholder="e.g., 15.00"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[commonStyles.button, styles.modalButton]}
                onPress={() => setEditingCookingPrefs(false)}
              >
                <Text style={commonStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  commonStyles.button,
                  commonStyles.buttonPrimary,
                  styles.modalButton,
                ]}
                onPress={handleSaveCookingPrefs}
              >
                <Text
                  style={[
                    commonStyles.buttonText,
                    commonStyles.buttonTextPrimary,
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Macro Targets Edit Modal */}
      <Modal
        visible={editingMacros}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMacros(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[commonStyles.card, styles.modalContent]}>
            <Text style={commonStyles.h3}>Edit Macro Targets</Text>
            <Text style={[commonStyles.bodySecondary, { marginTop: 8 }]}>
              Set your daily nutrition goals (optional)
            </Text>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Daily Calories (kcal):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempCalories}
                onChangeText={setTempCalories}
                keyboardType="number-pad"
                placeholder="e.g., 2000"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Protein (grams):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempProtein}
                onChangeText={setTempProtein}
                keyboardType="number-pad"
                placeholder="e.g., 150"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Carbs (grams):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempCarbs}
                onChangeText={setTempCarbs}
                keyboardType="number-pad"
                placeholder="e.g., 200"
              />
            </View>

            <View style={styles.modalInput}>
              <Text style={commonStyles.body}>Fat (grams):</Text>
              <TextInput
                style={commonStyles.input}
                value={tempFat}
                onChangeText={setTempFat}
                keyboardType="number-pad"
                placeholder="e.g., 70"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[commonStyles.button, styles.modalButton]}
                onPress={() => setEditingMacros(false)}
              >
                <Text style={commonStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  commonStyles.button,
                  commonStyles.buttonPrimary,
                  styles.modalButton,
                ]}
                onPress={handleSaveMacros}
              >
                <Text
                  style={[
                    commonStyles.buttonText,
                    commonStyles.buttonTextPrimary,
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  emptyRestrictions: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  restrictionsList: {
    marginTop: theme.spacing.md,
  },
  restrictionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  severityBadge: {
    marginTop: theme.spacing.xs,
  },
  restrictionNotes: {
    marginTop: theme.spacing.xs,
  },
  removeButton: {
    padding: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  editButton: {
    padding: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: theme.spacing.lg,
  },
  modalInput: {
    marginTop: theme.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  pickerButton: {
    justifyContent: 'center',
    minHeight: 44,
  },
}));
