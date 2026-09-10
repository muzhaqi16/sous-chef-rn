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

function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
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

  // Translate enum values via per-value keys, falling back to the formatted
  // raw value (e.g. "Tree Nut") when no translation is registered.
  const formatDiet = (value: string) =>
    t(`recipes.diet.${value}`, formatEnumLabel(value));
  const formatHealthGoal = (value: string) =>
    t(`recipes.healthGoal.${value}`, formatEnumLabel(value));
  const formatIntolerance = (value: string) =>
    t(`recipes.intolerance.${value}`, formatEnumLabel(value));

  return (
    <View style={styles.container}>
      <SectionHeader variant="title" style={styles.sectionTitle}>
        {t('recipes.tagsTitle')}
      </SectionHeader>

      {/* Diets */}
      <ChipGroup
        label={t('recipes.diets')}
        items={diets}
        formatLabel={formatDiet}
        onPress={() => setShowDiets(true)}
      />

      {/* Health Goals */}
      <ChipGroup
        label={t('recipes.healthGoals')}
        items={healthGoals}
        formatLabel={formatHealthGoal}
        onPress={() => setShowHealthGoals(true)}
      />

      {/* Intolerances */}
      <ChipGroup
        label={t('recipes.intolerances')}
        items={intolerances}
        formatLabel={formatIntolerance}
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
  items: string[];
  formatLabel: (value: string) => string;
  onPress: () => void;
}

const ChipGroup: React.FC<ChipGroupProps> = ({
  label,
  items,
  formatLabel,
  onPress,
}) => {
  const { t } = useTranslation();
  return (
    <AppPressable onPress={onPress} style={styles.chipGroup}>
      <Text role="label" tone="secondary" style={styles.chipGroupLabel}>
        {label}
      </Text>
      <View style={styles.chipsRow}>
        {items.length > 0 ? (
          items.map(item => (
            <View key={item} style={styles.chip}>
              <Text role="caption" tone="accent">
                {formatLabel(item)}
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
