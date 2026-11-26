import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from '#i18n';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { EditableCounter } from '#components/molecules/EditableCounter';
import type { RecipeFormState } from '#features/recipes/types';

interface RecipeBasicFieldsProps {
  control: Control<RecipeFormState>;
}

export const RecipeBasicFields: React.FC<RecipeBasicFieldsProps> = ({
  control,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            ref={field.ref}
            label={t('recipes.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.namePlaceholder')}
            error={fieldState.error?.message}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormTextArea
            ref={field.ref}
            label={t('labels.description')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.descriptionPlaceholder')}
          />
        )}
      />

      <Controller
        control={control}
        name="imageUrl"
        render={({ field, fieldState }) => (
          <FormInput
            ref={field.ref}
            label={t('recipes.imageUrl')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.imageUrlPlaceholder')}
            keyboardType="url"
            autoCapitalize="none"
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="videoUrl"
        render={({ field, fieldState }) => (
          <FormInput
            ref={field.ref}
            label={t('recipes.videoUrl')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.imageUrlPlaceholder')}
            keyboardType="url"
            autoCapitalize="none"
            error={fieldState.error?.message}
          />
        )}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Controller
            control={control}
            name="servings"
            render={({ field }) => (
              <EditableCounter
                ref={field.ref}
                label={t('labels.servings')}
                value={field.value}
                onChangeText={field.onChange}
                min={1}
                step={1}
              />
            )}
          />
        </View>
        <View style={styles.halfField}>
          <Controller
            control={control}
            name="caloriesPerServing"
            render={({ field }) => (
              <EditableCounter
                ref={field.ref}
                label={t('recipes.caloriesPerServing')}
                value={field.value}
                onChangeText={field.onChange}
                min={0}
                step={10}
                notation="decimal"
              />
            )}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Controller
            control={control}
            name="prepTimeMinutes"
            render={({ field }) => (
              <EditableCounter
                ref={field.ref}
                label={t('recipes.prepTimeMin')}
                value={field.value}
                onChangeText={field.onChange}
                min={0}
                step={5}
              />
            )}
          />
        </View>
        <View style={styles.halfField}>
          <Controller
            control={control}
            name="cookTimeMinutes"
            render={({ field }) => (
              <EditableCounter
                ref={field.ref}
                label={t('recipes.cookTimeMin')}
                value={field.value}
                onChangeText={field.onChange}
                min={0}
                step={5}
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="tips"
        render={({ field, fieldState }) => (
          <FormTextArea
            ref={field.ref}
            label={t('labels.tips')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.tipsPlaceholder')}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="tags"
        render={({ field, fieldState }) => (
          <FormInput
            ref={field.ref}
            label={t('labels.tags')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('labels.commaSeparated')}
            autoCapitalize="none"
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="originalAuthor"
        render={({ field }) => (
          <FormInput
            ref={field.ref}
            label={t('recipes.originalAuthor')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('recipes.originalAuthorPlaceholder')}
          />
        )}
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
