import React, { useState } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { MultiSelectChipSheet } from '#components/organisms/MultiSelectChipSheet/MultiSelectChipSheet';
import { Text } from '#components/atoms/Text';
import { Diet, HealthGoal, Intolerance } from '#/graphql/generated/schemaTypes';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface RecipeTagsSectionProps {
  diets: Diet[];
  healthGoals: HealthGoal[];
  intolerances: Intolerance[];
  onDietsChange: (diets: Diet[]) => void;
  onHealthGoalsChange: (goals: HealthGoal[]) => void;
  onIntolerancesChange: (intolerances: Intolerance[]) => void;
}

const ALL_DIETS = Object.values(Diet);
const ALL_HEALTH_GOALS = Object.values(HealthGoal);
const ALL_INTOLERANCES = Object.values(Intolerance);

export const RecipeTagsSection: React.FC<RecipeTagsSectionProps> = ({
  diets,
  healthGoals,
  intolerances,
  onDietsChange,
  onHealthGoalsChange,
  onIntolerancesChange,
}) => {
  const { t } = useTranslation();
  const [showDiets, setShowDiets] = useState(false);
  const [showHealthGoals, setShowHealthGoals] = useState(false);
  const [showIntolerances, setShowIntolerances] = useState(false);

  const formatDiet = (value: Diet) => t(`recipes.diet.${value}`);
  const formatHealthGoal = (value: HealthGoal) =>
    t(`recipes.healthGoal.${value}`);
  const formatIntolerance = (value: Intolerance) =>
    t(`recipes.intolerance.${value}`);

  return (
    <View style={styles.container}>
      <SectionHeader variant="title" style={styles.sectionTitle}>
        {t('recipes.tagsTitle')}
      </SectionHeader>

      {/* Diets */}
      <ChipGroup
        label={t('recipes.diets')}
        chips={diets.map(value => ({ id: value, label: formatDiet(value) }))}
        onPress={() => setShowDiets(true)}
      />

      {/* Health Goals */}
      <ChipGroup
        label={t('recipes.healthGoals')}
        chips={healthGoals.map(value => ({
          id: value,
          label: formatHealthGoal(value),
        }))}
        onPress={() => setShowHealthGoals(true)}
      />

      {/* Intolerances */}
      <ChipGroup
        label={t('recipes.intolerances')}
        chips={intolerances.map(value => ({
          id: value,
          label: formatIntolerance(value),
        }))}
        onPress={() => setShowIntolerances(true)}
      />

      <MultiSelectChipSheet<Diet>
        visible={showDiets}
        title={t('recipes.diets')}
        items={ALL_DIETS.map(d => ({ id: d, label: formatDiet(d) }))}
        selectedItems={diets}
        onSelect={onDietsChange}
        onClose={() => setShowDiets(false)}
        onDone={() => setShowDiets(false)}
      />

      <MultiSelectChipSheet<HealthGoal>
        visible={showHealthGoals}
        title={t('recipes.healthGoals')}
        items={ALL_HEALTH_GOALS.map(g => ({
          id: g,
          label: formatHealthGoal(g),
        }))}
        selectedItems={healthGoals}
        onSelect={onHealthGoalsChange}
        onClose={() => setShowHealthGoals(false)}
        onDone={() => setShowHealthGoals(false)}
      />

      <MultiSelectChipSheet<Intolerance>
        visible={showIntolerances}
        title={t('recipes.intolerances')}
        items={ALL_INTOLERANCES.map(i => ({
          id: i,
          label: formatIntolerance(i),
        }))}
        selectedItems={intolerances}
        onSelect={onIntolerancesChange}
        onClose={() => setShowIntolerances(false)}
        onDone={() => setShowIntolerances(false)}
      />
    </View>
  );
};

interface ChipGroupProps {
  label: string;
  chips: Array<{ id: string; label: string }>;
  onPress: () => void;
}

const ChipGroup: React.FC<ChipGroupProps> = ({ label, chips, onPress }) => {
  const { t } = useTranslation();
  return (
    <AppPressable onPress={onPress} style={styles.chipGroup}>
      <Text role="label" tone="secondary" style={styles.chipGroupLabel}>
        {label}
      </Text>
      <View style={styles.chipsRow}>
        {chips.length > 0 ? (
          chips.map(chip => (
            <View key={chip.id} style={styles.chip}>
              <Text role="caption" tone="accent">
                {chip.label}
              </Text>
            </View>
          ))
        ) : (
          <Text role="caption" tone="tertiary">
            {t('recipes.tapToSelect')}
          </Text>
        )}
      </View>
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  chipGroup: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  chipGroupLabel: {
    marginBottom: theme.spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary + '20',
  },
}));
