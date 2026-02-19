import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { EditableCounter } from '#components/molecules/EditableCounter';
import type { RecipeFormState } from '../useRecipeForm';

interface RecipeBasicFieldsProps {
  state: RecipeFormState;
  updateField: <K extends keyof RecipeFormState>(field: K, value: RecipeFormState[K]) => void;
}

export const RecipeBasicFields: React.FC<RecipeBasicFieldsProps> = ({
  state,
  updateField,
}) => {
  return (
    <>
      <FormInput
        label="Recipe Name"
        value={state.name}
        onChangeText={v => updateField('name', v)}
        placeholder="e.g., Chicken Tikka Masala"
        required
      />

      <FormTextArea
        label="Description"
        value={state.description}
        onChangeText={v => updateField('description', v)}
        placeholder="A brief description of the recipe..."
      />

      <FormInput
        label="Image URL"
        value={state.imageUrl}
        onChangeText={v => updateField('imageUrl', v)}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <EditableCounter
            label="Servings"
            value={state.servings}
            onChangeText={v => updateField('servings', v)}
            min={1}
            step={1}
          />
        </View>
        <View style={styles.halfField}>
          <EditableCounter
            label="Calories/Serving"
            value={state.caloriesPerServing}
            onChangeText={v => updateField('caloriesPerServing', v)}
            min={0}
            step={10}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfField}>
          <EditableCounter
            label="Prep Time (min)"
            value={state.prepTimeMinutes}
            onChangeText={v => updateField('prepTimeMinutes', v)}
            min={0}
            step={5}
          />
        </View>
        <View style={styles.halfField}>
          <EditableCounter
            label="Cook Time (min)"
            value={state.cookTimeMinutes}
            onChangeText={v => updateField('cookTimeMinutes', v)}
            min={0}
            step={5}
          />
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfField: {
    flex: 1,
  },
}));
