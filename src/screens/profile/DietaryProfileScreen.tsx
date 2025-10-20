import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import { DietaryTag, RestrictionSeverity } from '#generated';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#/utils';

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
  const { profile, loading, addDietaryRestriction, removeDietaryRestriction } =
    useDietaryProfile();

  const [showAddRestriction, setShowAddRestriction] = useState(false);

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
    <ScrollView style={commonStyles.container}>
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
                      color="#DC2626"
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
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Calories:</Text>
            <Text style={commonStyles.subtitle}>
              {profile.calorieTarget || 'Not set'}
              {profile.calorieTarget ? ' kcal/day' : ''}
            </Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Protein:</Text>
            <Text style={commonStyles.subtitle}>
              {profile.proteinTarget || 'Not set'}
              {profile.proteinTarget ? 'g/day' : ''}
            </Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Carbs:</Text>
            <Text style={commonStyles.subtitle}>
              {profile.carbsTarget || 'Not set'}
              {profile.carbsTarget ? 'g/day' : ''}
            </Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Fat:</Text>
            <Text style={commonStyles.subtitle}>
              {profile.fatTarget || 'Not set'}
              {profile.fatTarget ? 'g/day' : ''}
            </Text>
          </View>
        </View>

        <View style={[commonStyles.card, styles.mealPlanCard]}>
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Meals per day:</Text>
            <Text style={commonStyles.subtitle}>{profile.mealsPerDay}</Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={commonStyles.body}>Snacks per day:</Text>
            <Text style={commonStyles.subtitle}>{profile.snacksPerDay}</Text>
          </View>
        </View>
      </View>

      {/* Food Preferences Section */}
      <View style={styles.section}>
        <Text style={commonStyles.h3}>Food Preferences</Text>

        {profile.preferredCuisines.length > 0 && (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Preferred Cuisines</Text>
            <View style={styles.chipContainer}>
              {profile.preferredCuisines.map((cuisine, index) => (
                <View
                  key={index}
                  style={[commonStyles.chip, styles.preferenceChip]}
                >
                  <Text style={commonStyles.chipText}>{cuisine}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {profile.favoriteIngredients.length > 0 && (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Favorite Ingredients</Text>
            <View style={styles.chipContainer}>
              {profile.favoriteIngredients.map((ingredient, index) => (
                <View
                  key={index}
                  style={[commonStyles.chip, styles.favoriteChip]}
                >
                  <Text style={commonStyles.chipText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {profile.dislikedIngredients.length > 0 && (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>Disliked Ingredients</Text>
            <View style={styles.chipContainer}>
              {profile.dislikedIngredients.map((ingredient, index) => (
                <View
                  key={index}
                  style={[commonStyles.chip, styles.dislikedChip]}
                >
                  <Text style={commonStyles.chipText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Cooking Preferences Section */}
      <View style={styles.section}>
        <Text style={commonStyles.h3}>Cooking Preferences</Text>
        <View style={commonStyles.card}>
          {profile.cookingSkillLevel && (
            <View style={styles.nutritionRow}>
              <Text style={commonStyles.body}>Skill Level:</Text>
              <Text style={commonStyles.subtitle}>
                {profile.cookingSkillLevel}
              </Text>
            </View>
          )}
          {profile.maxPrepTimeMinutes && (
            <View style={styles.nutritionRow}>
              <Text style={commonStyles.body}>Max Prep Time:</Text>
              <Text style={commonStyles.subtitle}>
                {profile.maxPrepTimeMinutes} minutes
              </Text>
            </View>
          )}
          {profile.maxCookTimeMinutes && (
            <View style={styles.nutritionRow}>
              <Text style={commonStyles.body}>Max Cook Time:</Text>
              <Text style={commonStyles.subtitle}>
                {profile.maxCookTimeMinutes} minutes
              </Text>
            </View>
          )}
          {profile.budgetPerMeal && (
            <View style={styles.nutritionRow}>
              <Text style={commonStyles.body}>Budget per Meal:</Text>
              <Text style={commonStyles.subtitle}>
                ${profile.budgetPerMeal}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    padding: theme.spacing.md,
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
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  mealPlanCard: {
    marginTop: theme.spacing.sm,
  },
  preferenceChip: {
    marginRight: 0,
    backgroundColor: theme.colors.primaryLight,
  },
  favoriteChip: {
    marginRight: 0,
    backgroundColor: theme.colors.success + '20',
  },
  dislikedChip: {
    marginRight: 0,
    backgroundColor: theme.colors.error + '20',
  },
}));
