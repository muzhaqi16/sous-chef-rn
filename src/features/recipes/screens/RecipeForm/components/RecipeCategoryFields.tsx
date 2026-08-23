import React from 'react';
import { useTranslation } from '#/i18n';
import { FormInput } from '#components/molecules/FormInput';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Difficulty, RecipeStatus } from '#/graphql/generated/schemaTypes';
import type { RecipeFormState } from '../useRecipeForm';

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

function formatEnum(value: string): string {
  return value
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export const RecipeCategoryFields: React.FC<RecipeCategoryFieldsProps> = ({
  state,
  updateField,
}) => {
  const { t } = useTranslation();
  // Translate enum values via per-value keys, falling back to the formatted
  // raw value (e.g. "Very Easy") when no translation is registered.
  const formatDifficulty = (value: string) =>
    t(`recipes.difficultyLabel.${value}`, formatEnum(value));
  const formatStatus = (value: string) =>
    t(`recipes.recipeStatus.${value}`, formatEnum(value));
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

      <FormInput
        label={t('recipes.cuisine')}
        value={state.cuisine}
        onChangeText={v => updateField('cuisine', v)}
        placeholder={t('recipes.cuisinePlaceholder')}
      />

      <SegmentedControl
        label={t('labels.status')}
        options={STATUSES}
        value={state.status}
        onChange={v => updateField('status', v)}
        formatLabel={formatStatus}
      />
    </>
  );
};
