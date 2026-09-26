import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import {
  Difficulty,
  RecipeStatus,
  type Cuisine,
} from '#/graphql/generated/schemaTypes';
import type { RecipeFormState } from '#features/recipes/screens/RecipeForm/formState';
import { CuisineChips } from '#features/recipes/ui/CuisineChips';

interface RecipeCategoryFieldsProps {
  state: RecipeFormState;
  updateField: <K extends keyof RecipeFormState>(
    field: K,
    value: RecipeFormState[K],
  ) => void;
}

const DIFFICULTIES = [
  Difficulty.VeryEasy,
  Difficulty.Easy,
  Difficulty.Medium,
  Difficulty.Hard,
  Difficulty.Expert,
];
const STATUSES = [RecipeStatus.Draft, RecipeStatus.Published];

export const RecipeCategoryFields: React.FC<RecipeCategoryFieldsProps> = ({
  state,
  updateField,
}) => {
  const { t } = useTranslation();
  const formatDifficulty = (value: Difficulty) =>
    t(`recipes.difficultyLabel.${value}`);
  const formatStatus = (value: RecipeStatus) =>
    t(`recipes.recipeStatus.${value}`);
  const toggleCuisine = (cuisine: Cuisine) =>
    updateField(
      'cuisines',
      state.cuisines.includes(cuisine)
        ? state.cuisines.filter(c => c !== cuisine)
        : [...state.cuisines, cuisine],
    );
  return (
    <>
      {!!state.difficulty && (
        <SegmentedControl
          label={t('recipes.difficulty')}
          options={DIFFICULTIES}
          value={state.difficulty}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatDifficulty}
        />
      )}
      {!state.difficulty && (
        <SegmentedControl
          label={t('recipes.difficulty')}
          options={DIFFICULTIES}
          value={Difficulty.Medium}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatDifficulty}
        />
      )}

      <View style={styles.cuisines}>
        <Text role="bodyStrong" style={styles.cuisinesLabel}>
          {t('recipes.cuisine')}
        </Text>
        <CuisineChips selected={state.cuisines} onToggle={toggleCuisine} />
      </View>

      {/* A recipe in review was submitted: it sits on the publish side. */}
      <SegmentedControl
        label={t('labels.status')}
        options={STATUSES}
        value={
          state.status === RecipeStatus.PendingReview
            ? RecipeStatus.Published
            : state.status
        }
        onChange={v => updateField('status', v)}
        formatLabel={formatStatus}
      />
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  cuisines: {
    marginBottom: theme.spacing.md,
  },
  cuisinesLabel: {
    marginBottom: theme.spacing.sm,
  },
}));
