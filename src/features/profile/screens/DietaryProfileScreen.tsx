import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { SubScreen } from '#components/templates/SubScreen';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import type {
  Diet,
  RestrictionKindInput,
} from '#/graphql/generated/schemaTypes';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { commonStyles } from '#/styles/commonStyles';
import { Icon } from '#components/atoms/Icon';
import { InfoRow } from '#components/atoms/InfoRow';
import { dietGroup } from '#domain/dietary';
import { ReligiousDietPicker } from '#features/profile/ui/ReligiousDietPicker';
import { DietaryRestrictionSelector } from '#features/profile/components/DietaryRestrictionSelector';
import type { RestrictionSectionItem } from '#features/profile/components/RestrictionSection/RestrictionSection';
import { DietarySharingSection } from '#features/profile/components/DietarySharingSection';
import { useDietarySharing } from '#features/profile/hooks/useDietarySharing';
import { CookingPreferencesSheet } from '#features/profile/components/CookingPreferencesSheet/CookingPreferencesSheet';
import { MacroTargetsSheet } from '#features/profile/components/MacroTargetsSheet/MacroTargetsSheet';
import { Text } from '#components/atoms/Text';
import { errorService } from '#/services/errorService';
import { motion } from '#/theme/motion';
import { DataStateView } from '#components/organisms/DataStateView';

export const DietaryProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    editableProfile: profile,
    loading,
    state,
    refetch,
    updateDietaryProfile,
    addDietaryRestriction,
    removeDietaryRestriction,
  } = useDietaryProfile();
  const sharing = useDietarySharing();

  const handleRemoveRestriction = ({ id, label }: RestrictionSectionItem) => {
    alertService.alert(
      t('labels.removeNamed', { name: label }),
      t('dietary.removeRestrictionConfirm'),
      [
        {
          text: t('labels.remove'),
          style: 'destructive',
          onPress: () => {
            void removeDietaryRestriction(id).then(success => {
              if (!success) {
                alertService.alert(
                  t('labels.error'),
                  t('dietary.removeRestrictionFailed'),
                );
              }
            });
          },
        },
        { text: t('labels.cancel'), style: 'cancel' },
      ],
    );
  };

  // Batch add restrictions handler
  const handleAddRestrictions = async (
    restrictions: RestrictionKindInput[],
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

  // Adds before it removes: a dropped diet goes only once no add in its group
  // failed, so a group never holds two and a failed add keeps its old diet.
  const handleChangeDiets = async (added: Diet[], removedIds: string[]) => {
    const outcomes = await Promise.all(
      added.map(diet =>
        addDietaryRestriction({ diet }, RestrictionSeverity.Preference),
      ),
    );
    const failedGroups = new Set(
      added.flatMap((diet, index) =>
        outcomes[index] ? [] : [dietGroup(diet)],
      ),
    );
    const removable = removedIds.filter(id => {
      const diet = profile?.restrictions.find(row => row.id === id)?.diet;
      return !diet || !failedGroups.has(dietGroup(diet));
    });
    const removed = await Promise.all(
      removable.map(id => removeDietaryRestriction(id)),
    );
    // A silent failure here leaves two diets of one group held.
    if (!removed.every(Boolean)) {
      alertService.alert(
        t('labels.error'),
        t('dietary.removeRestrictionFailed'),
      );
    }
    return failedGroups.size === 0;
  };

  // Cooking preferences state
  const [editingCookingPrefs, setEditingCookingPrefs] = useState(false);

  const handleSaveCookingPrefs = async (values: {
    maxCookTimeMinutes?: number | null;
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
    calorieTarget?: number | null;
    proteinTarget?: number | null;
    carbsTarget?: number | null;
    fatTarget?: number | null;
  }) => {
    const success = await updateDietaryProfile(values);
    if (success) {
      setEditingMacros(false);
    }
    return success;
  };

  // Modal handlers
  const handleOpenCookingPrefs = () => setEditingCookingPrefs(true);
  const handleCloseCookingPrefs = () => setEditingCookingPrefs(false);
  const handleOpenMacros = () => setEditingMacros(true);
  const handleCloseMacros = () => setEditingMacros(false);

  // Gate on "nothing to show", not on `loading` — `cache-and-network` reports
  // `loading: true` for the whole network leg on every mount, so a bare
  // `if (loading)` blanks the screen for up to httpLink's 10s abort. Both
  // non-content states stay inside SubScreen, which is what keeps a
  // back button on screen while it waits.
  if (loading && !profile) {
    return (
      <SubScreen title={t('dietary.title')} scroll="none">
        <View style={commonStyles.loadingContainer}>
          <Text role="body" style={commonStyles.loadingText}>
            {t('dietary.loadingProfile')}
          </Text>
        </View>
      </SubScreen>
    );
  }

  if (!profile) {
    return (
      <SubScreen title={t('dietary.title')} scroll="none">
        <DataStateView
          state={state}
          onRetry={() => {
            void refetch();
          }}
        />
      </SubScreen>
    );
  }

  const hasMacroTarget = [
    profile.calorieTarget,
    profile.proteinTarget,
    profile.carbsTarget,
    profile.fatTarget,
  ].some(target => !!target);

  return (
    <SubScreen title={t('dietary.title')}>
      {/* Dietary Restrictions Section */}
      <Animated.View
        entering={FadeIn.duration(motion.timing.SLOW)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <Text role="bodyStrong" tone="secondary">
          {t('dietary.restrictions')}
        </Text>
        <View style={styles.sectionCard}>
          <DietaryRestrictionSelector
            existingRestrictions={profile.restrictions}
            onAdd={handleAddRestrictions}
            onRemove={handleRemoveRestriction}
            onChangeDiets={handleChangeDiets}
          />
        </View>
        <View style={styles.sectionCard}>
          <ReligiousDietPicker
            value={profile.religiousDiet}
            onChange={religiousDiet => {
              void updateDietaryProfile({ religiousDiet });
            }}
          />
        </View>
      </Animated.View>
      {/* Shared With Section: one switch per home the user belongs to */}
      {sharing.homes.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(motion.timing.SLOW).delay(50)}
          layout={LinearTransition}
          style={styles.sectionContainer}
        >
          <Text role="bodyStrong" tone="secondary">
            {t('dietary.sharedWith')}
          </Text>
          <View style={styles.sectionCard}>
            <DietarySharingSection
              homes={sharing.homes}
              onChange={sharing.setShared}
            />
          </View>
        </Animated.View>
      )}
      {/* Cooking Preferences Section */}
      <Animated.View
        entering={FadeIn.duration(motion.timing.SLOW).delay(100)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text role="bodyStrong" tone="secondary">
              {t('labels.cookingPreferences')}
            </Text>
            <AppPressable
              onPress={handleOpenCookingPrefs}
              accessibilityLabel={t('a11y.editNamed', {
                name: t('labels.cookingPreferences'),
              })}
              style={styles.editButton}
            >
              <Icon name="create-outline" size={20} tone="primary" />
            </AppPressable>
          </View>
          {profile.maxCookTimeMinutes ? (
            <InfoRow
              label={t('labels.maxCookTime')}
              value={profile.maxCookTimeMinutes}
              unit={t('dietary.minutes')}
              showBorder={false}
            />
          ) : (
            <Text role="caption" tone="secondary">
              {t('dietary.cookTimeEmpty')}
            </Text>
          )}
        </View>
      </Animated.View>
      {/* Macro Targets Section (Advanced) */}
      <Animated.View
        entering={FadeIn.duration(motion.timing.SLOW).delay(150)}
        layout={LinearTransition}
        style={styles.sectionContainer}
      >
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text role="bodyStrong" tone="secondary">
              {t('dietary.macroTargets')}
            </Text>
            <AppPressable
              onPress={handleOpenMacros}
              accessibilityLabel={t('a11y.editNamed', {
                name: t('macroTargets.title'),
              })}
              style={styles.editButton}
            >
              <Icon name="create-outline" size={20} tone="primary" />
            </AppPressable>
          </View>
          {!hasMacroTarget && (
            <Text role="caption" tone="secondary">
              {t('dietary.macroTargetsEmpty')}
            </Text>
          )}
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
      {/* Cooking Preferences Sheet */}
      <CookingPreferencesSheet
        visible={editingCookingPrefs}
        onClose={handleCloseCookingPrefs}
        onSave={handleSaveCookingPrefs}
        initialValues={{ maxCookTimeMinutes: profile.maxCookTimeMinutes }}
      />
      {/* Macro Targets Sheet */}
      <MacroTargetsSheet
        visible={editingMacros}
        onClose={handleCloseMacros}
        onSave={handleSaveMacros}
        initialValues={{
          calorieTarget: profile.calorieTarget,
          proteinTarget: profile.proteinTarget,
          carbsTarget: profile.carbsTarget,
          fatTarget: profile.fatTarget,
        }}
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionContainer: {
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
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
}));

export default DietaryProfileScreen;
