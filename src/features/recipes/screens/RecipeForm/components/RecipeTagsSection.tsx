import React, { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { MultiSelectChipSheet } from '#components/molecules/MultiSelectChipSheet/MultiSelectChipSheet';
import { Text } from '#components/atoms/Text';
import { Diet, HealthGoal, Intolerance } from '#/graphql/generated/schemaTypes';

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
  const [showDiets, setShowDiets] = useState(false);
  const [showHealthGoals, setShowHealthGoals] = useState(false);
  const [showIntolerances, setShowIntolerances] = useState(false);

  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Tags & Dietary Info
      </Text>

      {/* Diets */}
      <ChipGroup
        label="Diets"
        items={diets}
        formatLabel={formatEnumLabel}
        onPress={() => setShowDiets(true)}
      />

      {/* Health Goals */}
      <ChipGroup
        label="Health Goals"
        items={healthGoals}
        formatLabel={formatEnumLabel}
        onPress={() => setShowHealthGoals(true)}
      />

      {/* Intolerances */}
      <ChipGroup
        label="Intolerances"
        items={intolerances}
        formatLabel={formatEnumLabel}
        onPress={() => setShowIntolerances(true)}
      />

      <MultiSelectChipSheet<Diet>
        visible={showDiets}
        title="Diets"
        items={ALL_DIETS.map(d => ({ id: d, label: formatEnumLabel(d) }))}
        selectedItems={diets}
        onSelect={onDietsChange}
        onClose={() => setShowDiets(false)}
        onDone={() => setShowDiets(false)}
      />

      <MultiSelectChipSheet<HealthGoal>
        visible={showHealthGoals}
        title="Health Goals"
        items={ALL_HEALTH_GOALS.map(g => ({
          id: g,
          label: formatEnumLabel(g),
        }))}
        selectedItems={healthGoals}
        onSelect={onHealthGoalsChange}
        onClose={() => setShowHealthGoals(false)}
        onDone={() => setShowHealthGoals(false)}
      />

      <MultiSelectChipSheet<Intolerance>
        visible={showIntolerances}
        title="Intolerances"
        items={ALL_INTOLERANCES.map(i => ({
          id: i,
          label: formatEnumLabel(i),
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
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.chipGroup, pressed && styles.pressed]}
  >
    <Text
      size="sm"
      weight="medium"
      tone="secondary"
      style={styles.chipGroupLabel}
    >
      {label}
    </Text>
    <View style={styles.chipsRow}>
      {items.length > 0 ? (
        items.map(item => (
          <View key={item} style={styles.chip}>
            <Text size="sm" tone="accent">
              {formatLabel(item)}
            </Text>
          </View>
        ))
      ) : (
        <Text size="sm" tone="tertiary">
          Tap to select...
        </Text>
      )}
    </View>
  </Pressable>
);

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
    backgroundColor: theme.colors.primary + '20',
  },
}));
