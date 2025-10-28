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
import { ProfileScreenWrapper } from '#components/templates';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import { DietaryTag, RestrictionSeverity } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils';
import { StringArrayManager } from '#/components/organisms';
import { NumberInputModal } from '#/components/organisms/modal';
import { InfoRow } from '#/components/molecules/InfoRow';

const DIETARY_TAGS: { label: string; value: DietaryTag }[] = [
  { label: 'Vegetarian', value: DietaryTag.Vegetarian },
  { label: 'Vegan', value: DietaryTag.Vegan },
  { label: 'Gluten Free', value: DietaryTag.GlutenFree },
  { label: 'Dairy Free', value: DietaryTag.DairyFree },
  { label: 'Nut Free', value: DietaryTag.NutFree },
  { label: 'Soy Free', value: DietaryTag.SoyFree },
  { label: 'Egg Free', value: DietaryTag.EggFree },
  { label: 'Fish Free', value: DietaryTag.FishFree },
  { label: 'Shellfish Free', value: DietaryTag.ShellfishFree },
  { label: 'Low Carb', value: DietaryTag.LowCarb },
  { label: 'Keto', value: DietaryTag.Keto },
  { label: 'Paleo', value: DietaryTag.Paleo },
  { label: 'Halal', value: DietaryTag.Halal },
  { label: 'Kosher', value: DietaryTag.Kosher },
  { label: 'Low Sodium', value: DietaryTag.LowSodium },
  { label: 'Sugar Free', value: DietaryTag.SugarFree },
  { label: 'Diabetic Friendly', value: DietaryTag.DiabeticFriendly },
  { label: 'Heart Healthy', value: DietaryTag.HeartHealthy },
];

const SEVERITY_LABELS: Record<
  RestrictionSeverity,
  { label: string; color: string }
> = {
  [RestrictionSeverity.Allergy]: { label: 'Allergy', color: '#DC2626' },
  [RestrictionSeverity.Intolerance]: { label: 'Intolerance', color: '#EA580C' },
  [RestrictionSeverity.Preference]: { label: 'Preference', color: '#2563EB' },
  [RestrictionSeverity.Goal]: { label: 'Goal', color: '#16A34A' },
};

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
  const [showAddRestriction, setShowAddRestriction] = useState(false);
  const [editingMeals, setEditingMeals] = useState(false);
  const [editingSnacks, setEditingSnacks] = useState(false);

  const handleAddRestriction = async (tag: DietaryTag) => {
    Alert.alert('Add Dietary Restriction', 'Select the severity level:', [
      {
        text: 'Allergy',
        onPress: async () => {
          const success = await addDietaryRestriction(
            tag,
            RestrictionSeverity.Allergy,
          );
          if (success) {
            setShowAddRestriction(false);
          } else {
            Alert.alert('Error', 'Failed to add restriction');
          }
        },
      },
      {
        text: 'Intolerance',
        onPress: async () => {
          const success = await addDietaryRestriction(
            tag,
            RestrictionSeverity.Intolerance,
          );
          if (success) {
            setShowAddRestriction(false);
          } else {
            Alert.alert('Error', 'Failed to add restriction');
          }
        },
      },
      {
        text: 'Preference',
        onPress: async () => {
          const success = await addDietaryRestriction(
            tag,
            RestrictionSeverity.Preference,
          );
          if (success) {
            setShowAddRestriction(false);
          } else {
            Alert.alert('Error', 'Failed to add restriction');
          }
        },
      },
      {
        text: 'Goal',
        onPress: async () => {
          const success = await addDietaryRestriction(
            tag,
            RestrictionSeverity.Goal,
          );
          if (success) {
            setShowAddRestriction(false);
          } else {
            Alert.alert('Error', 'Failed to add restriction');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemoveRestriction = async (id: string) => {
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

  const existingRestrictionTypes = profile.restrictions.map(r => r.type);
  const availableTags = DIETARY_TAGS.filter(
    tag => !existingRestrictionTypes.includes(tag.value),
  );

  return (
    <ProfileScreenWrapper title="Dietary Profile">
      {/* Dietary Restrictions Section */}
      <View style={styles.section}>
        <View style={commonStyles.rowSpaceBetween}>
          <Text style={commonStyles.h3}>Dietary Restrictions</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddRestriction(!showAddRestriction)}
          >
            <Icon
              library="Feather"
              name={showAddRestriction ? 'x' : 'plus'}
              size={20}
              color="#EF8354"
            />
          </TouchableOpacity>
        </View>

        {showAddRestriction && (
          <View style={styles.addRestrictionContainer}>
            <Text style={commonStyles.subtitle}>
              Select a restriction to add:
            </Text>
            <View style={styles.chipContainer}>
              {availableTags.map(tag => (
                <TouchableOpacity
                  key={tag.value}
                  style={[commonStyles.chip, styles.tagChip]}
                  onPress={() => handleAddRestriction(tag.value)}
                >
                  <Text style={commonStyles.chipText}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {profile.restrictions.length === 0 ? (
          <View style={styles.emptyRestrictions}>
            <Text style={commonStyles.bodySecondary}>
              No dietary restrictions added yet
            </Text>
          </View>
        ) : (
          <View style={styles.restrictionsList}>
            {profile.restrictions.map(restriction => {
              const tagLabel =
                DIETARY_TAGS.find(t => t.value === restriction.type)?.label ||
                restriction.type;
              const severityInfo = SEVERITY_LABELS[restriction.severity];

              return (
                <View
                  key={restriction.id}
                  style={[commonStyles.card, styles.restrictionCard]}
                >
                  <View style={commonStyles.flex1}>
                    <Text style={commonStyles.title}>{tagLabel}</Text>
                    <View style={styles.severityBadge}>
                      <View
                        style={[
                          commonStyles.badge,
                          { backgroundColor: severityInfo.color },
                        ]}
                      >
                        <Text style={commonStyles.badgeText}>
                          {severityInfo.label}
                        </Text>
                      </View>
                    </View>
                    {restriction.notes && (
                      <Text
                        style={[commonStyles.caption, styles.restrictionNotes]}
                      >
                        {restriction.notes}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveRestriction(restriction.id)}
                  >
                    <Icon
                      library="Feather"
                      name="trash-2"
                      size={18}
                      color={theme.colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Nutrition Goals Section */}
      <View style={styles.section}>
        <Text style={commonStyles.h3}>Nutrition Goals</Text>
        <View style={commonStyles.card}>
          <TouchableOpacity onPress={() => setEditingMeals(true)}>
            <InfoRow label="Meals per day" value={profile.mealsPerDay} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditingSnacks(true)}>
            <InfoRow label="Snacks per day" value={profile.snacksPerDay} showBorder={false} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Food Preferences Section */}
      <View style={styles.section}>
        <Text style={commonStyles.h3}>Food Preferences</Text>

        <StringArrayManager
          title="Preferred Cuisines"
          items={profile.preferredCuisines}
          onAdd={async (cuisine) => {
            return await updateDietaryProfile({
              preferredCuisines: [...profile.preferredCuisines, cuisine],
            });
          }}
          onRemove={async (cuisine) => {
            await updateDietaryProfile({
              preferredCuisines: profile.preferredCuisines.filter(c => c !== cuisine),
            });
          }}
          inputPlaceholder="e.g., Italian, Mexican, Thai"
          addButtonLabel="Add Cuisine"
          emptyMessage="No cuisines added yet"
          chipColor={theme.colors.primaryLight}
          containerStyle={{ marginTop: theme.spacing.sm }}
        />

        <StringArrayManager
          title="Favorite Ingredients"
          items={profile.favoriteIngredients}
          onAdd={async (ingredient) => {
            return await updateDietaryProfile({
              favoriteIngredients: [...profile.favoriteIngredients, ingredient],
            });
          }}
          onRemove={async (ingredient) => {
            await updateDietaryProfile({
              favoriteIngredients: profile.favoriteIngredients.filter(i => i !== ingredient),
            });
          }}
          inputPlaceholder="e.g., Garlic, Basil, Chicken"
          addButtonLabel="Add Favorite Ingredient"
          emptyMessage="No favorite ingredients added yet"
          chipColor={theme.colors.success + '20'}
          containerStyle={{ marginTop: theme.spacing.sm }}
        />

        <StringArrayManager
          title="Disliked Ingredients"
          items={profile.dislikedIngredients}
          onAdd={async (ingredient) => {
            return await updateDietaryProfile({
              dislikedIngredients: [...profile.dislikedIngredients, ingredient],
            });
          }}
          onRemove={async (ingredient) => {
            await updateDietaryProfile({
              dislikedIngredients: profile.dislikedIngredients.filter(i => i !== ingredient),
            });
          }}
          inputPlaceholder="e.g., Cilantro, Mushrooms, Olives"
          addButtonLabel="Add Disliked Ingredient"
          emptyMessage="No disliked ingredients added yet"
          chipColor={theme.colors.error + '20'}
          containerStyle={{ marginTop: theme.spacing.sm }}
        />
      </View>

      {/* Cooking Preferences Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={commonStyles.h3}>Cooking Preferences</Text>
          <TouchableOpacity
            onPress={handleEditCookingPrefs}
            style={styles.editButton}
          >
            <Icon library="Feather" name="edit" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={commonStyles.card}>
          {profile.cookingSkillLevel && (
            <InfoRow label="Skill Level" value={profile.cookingSkillLevel} />
          )}
          {profile.maxPrepTimeMinutes && (
            <InfoRow label="Max Prep Time" value={profile.maxPrepTimeMinutes} unit="minutes" />
          )}
          {profile.maxCookTimeMinutes && (
            <InfoRow label="Max Cook Time" value={profile.maxCookTimeMinutes} unit="minutes" />
          )}
          {profile.budgetPerMeal && (
            <InfoRow
              label="Budget per Meal"
              value={profile.budgetPerMeal}
              formatter={(val) => `$${val}`}
              showBorder={false}
            />
          )}
        </View>
      </View>

      {/* Macro Targets Section (Advanced) */}
      {(profile.calorieTarget ||
        profile.proteinTarget ||
        profile.carbsTarget ||
        profile.fatTarget) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={commonStyles.h3}>Macro Targets (Advanced)</Text>
            <TouchableOpacity
              onPress={handleEditMacros}
              style={styles.editButton}
            >
              <Icon library="Feather" name="edit" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={commonStyles.card}>
            {profile.calorieTarget && (
              <InfoRow label="Daily Calories" value={profile.calorieTarget} unit="kcal" />
            )}
            {profile.proteinTarget && (
              <InfoRow label="Protein" value={profile.proteinTarget} unit="g" />
            )}
            {profile.carbsTarget && (
              <InfoRow label="Carbs" value={profile.carbsTarget} unit="g" />
            )}
            {profile.fatTarget && (
              <InfoRow label="Fat" value={profile.fatTarget} unit="g" showBorder={false} />
            )}
          </View>
        </View>
      )}

      {/* Nutrition Goals Modals */}
      <NumberInputModal
        visible={editingMeals}
        title="Meals Per Day"
        value={profile.mealsPerDay}
        onSave={async (value) => {
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
        onSave={async (value) => {
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
                style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalButton]}
                onPress={handleSaveCookingPrefs}
              >
                <Text style={[commonStyles.buttonText, commonStyles.buttonTextPrimary]}>Save</Text>
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
                style={[commonStyles.button, commonStyles.buttonPrimary, styles.modalButton]}
                onPress={handleSaveMacros}
              >
                <Text style={[commonStyles.buttonText, commonStyles.buttonTextPrimary]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRestrictionContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  tagChip: {
    marginRight: 0,
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
