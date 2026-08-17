import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { EditableCounter } from '#components/molecules/EditableCounter';
import type { RecipeFormState } from '../useRecipeForm';

interface RecipeBasicFieldsProps {
  state: RecipeFormState;
  updateField: <K extends keyof RecipeFormState>(
    field: K,
    value: RecipeFormState[K],
  ) => void;
}

export const RecipeBasicFields: React.FC<RecipeBasicFieldsProps> = ({
  state,
  updateField,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <FormInput
        label={t('recipes.name')}
        value={state.name}
        onChangeText={v => updateField('name', v)}
        placeholder={t('recipes.namePlaceholder')}
        required
      />

      <FormTextArea
        label={t('recipes.description')}
        value={state.description}
        onChangeText={v => updateField('description', v)}
        placeholder={t('recipes.descriptionPlaceholder')}
      />

      <FormInput
        label={t('recipes.imageUrl')}
        value={state.imageUrl}
        onChangeText={v => updateField('imageUrl', v)}
        placeholder={t('recipes.imageUrlPlaceholder')}
        keyboardType="url"
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <EditableCounter
            label={t('recipes.servings')}
            value={state.servings}
            onChangeText={v => updateField('servings', v)}
            min={1}
            step={1}
          />
        </View>
        <View style={styles.halfField}>
          <EditableCounter
            label={t('recipes.caloriesPerServing')}
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
            label={t('recipes.prepTimeMin')}
            value={state.prepTimeMinutes}
            onChangeText={v => updateField('prepTimeMinutes', v)}
            min={0}
            step={5}
          />
        </View>
        <View style={styles.halfField}>
          <EditableCounter
            label={t('recipes.cookTimeMin')}
            value={state.cookTimeMinutes}
            onChangeText={v => updateField('cookTimeMinutes', v)}
            min={0}
            step={5}
          />
        </View>
      </View>

      <FormTextArea
        label={t('recipes.tips')}
        value={state.tips}
        onChangeText={v => updateField('tips', v)}
        placeholder={t('recipes.tipsPlaceholder')}
      />

      <FormInput
        label={t('recipes.recipeTags')}
        value={state.tags}
        onChangeText={v => updateField('tags', v)}
        placeholder={t('recipes.recipeTagsPlaceholder')}
        autoCapitalize="none"
      />

      <FormInput
        label={t('recipes.originalAuthor')}
        value={state.originalAuthor}
        onChangeText={v => updateField('originalAuthor', v)}
        placeholder={t('recipes.originalAuthorPlaceholder')}
      />
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
