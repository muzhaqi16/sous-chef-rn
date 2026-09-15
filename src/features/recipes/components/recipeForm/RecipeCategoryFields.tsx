import React from 'react';
import { useTranslation } from '#/i18n';
import { FormInput } from '#components/atoms/FormInput';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Difficulty, RecipeStatus } from '#/graphql/generated/schemaTypes';
import type { RecipeFormState } from '#features/recipes/screens/RecipeForm/formState';

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
