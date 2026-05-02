import React from 'react';
import { FormInput } from '#components/molecules/FormInput';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import {
  Difficulty,
  RecipeStatus,
} from '../../../../graphql/generated/schemaTypes';
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
  return (
    <>
      {!!state.difficulty && (
        <SegmentedControl
          label="Difficulty"
          options={DIFFICULTIES}
          value={state.difficulty}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatEnum}
        />
      )}
      {!state.difficulty && (
        <SegmentedControl
          label="Difficulty"
          options={DIFFICULTIES}
          value={Difficulty.Medium}
          onChange={v => updateField('difficulty', v)}
          formatLabel={formatEnum}
        />
      )}

      <FormInput
        label="Cuisine"
        value={state.cuisine}
        onChangeText={v => updateField('cuisine', v)}
        placeholder="e.g., Italian, Mexican, Thai..."
      />

      <SegmentedControl
        label="Status"
        options={STATUSES}
        value={state.status}
        onChange={v => updateField('status', v)}
        formatLabel={formatEnum}
      />
    </>
  );
};
