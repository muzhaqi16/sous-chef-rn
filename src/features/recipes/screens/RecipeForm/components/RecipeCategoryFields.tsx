import React from 'react';
import { useTranslation } from 'react-i18next';
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
  return (
    <>
      {!!state.difficulty && (
        <SegmentedControl
          label={t('recipes.difficulty')}
          options={DIFFICULTIES}
          value={state.difficulty}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatEnum}
        />
      )}
      {!state.difficulty && (
        <SegmentedControl
          label={t('recipes.difficulty')}
          options={DIFFICULTIES}
          value={Difficulty.Medium}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatEnum}
        />
      )}

      <FormInput
        label={t('recipes.cuisine')}
        value={state.cuisine}
        onChangeText={v => updateField('cuisine', v)}
        placeholder={t('recipes.cuisinePlaceholder')}
      />

      <SegmentedControl
        label={t('recipes.status')}
        options={STATUSES}
        value={state.status}
        onChange={v => updateField('status', v)}
        formatLabel={formatEnum}
      />
    </>
  );
};
