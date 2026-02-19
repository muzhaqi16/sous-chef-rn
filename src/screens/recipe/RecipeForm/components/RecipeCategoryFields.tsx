import React from 'react';
import { View, Switch, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { Difficulty, Visibility } from '#generated';
import type { RecipeFormState } from '../useRecipeForm';

interface RecipeCategoryFieldsProps {
  state: RecipeFormState;
  updateField: <K extends keyof RecipeFormState>(field: K, value: RecipeFormState[K]) => void;
}

const DIFFICULTIES = [Difficulty.VeryEasy, Difficulty.Easy, Difficulty.Medium, Difficulty.Hard, Difficulty.Expert] as const;
const VISIBILITIES = [Visibility.Private, Visibility.Public] as const;

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
      {state.difficulty && (
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

      {state.visibility && (
        <SegmentedControl
          label="Visibility"
          options={VISIBILITIES}
          value={state.visibility}
          onChange={v => updateField('visibility', v)}
          formatLabel={formatEnum}
        />
      )}
      {!state.visibility && (
        <SegmentedControl
          label="Visibility"
          options={VISIBILITIES}
          value={Visibility.Private}
          onChange={v => updateField('visibility', v)}
          formatLabel={formatEnum}
        />
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Published</Text>
        <Switch
          value={state.isPublished}
          onValueChange={v => updateField('isPublished', v)}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  switchLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
}));
