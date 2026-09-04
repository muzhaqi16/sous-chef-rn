import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { IngredientFormState } from '#features/recipes/screens/RecipeForm/formState';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface RecipeIngredientListProps {
  ingredients: IngredientFormState[];
  onEditIngredient: (ingredient: IngredientFormState) => void;
  onRemoveIngredient: (id: string) => void;
  onAddIngredient: () => void;
  /** The section's own refusal — an empty list, or a blank entry in it. */
  error?: string;
}

export const RecipeIngredientList: React.FC<RecipeIngredientListProps> = ({
  ingredients,
  onEditIngredient,
  onRemoveIngredient,
  onAddIngredient,
  error,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <SectionHeader variant="title" style={styles.sectionTitle}>
        {t('recipes.ingredientsCount', { count: ingredients.length })}
      </SectionHeader>
      {ingredients.map(ingredient => (
        <AppPressable
          key={ingredient.id}
          onPress={() => onEditIngredient(ingredient)}
          style={styles.ingredientRow}
        >
          <View style={styles.ingredientInfo}>
            <Text role="bodyStrong">
              {ingredient.name || t('recipes.unnamedIngredient')}
            </Text>
            <Text role="caption" tone="secondary" style={styles.ingredientMeta}>
              {ingredient.quantity}
              {ingredient.preparation
                ? ` \u00B7 ${ingredient.preparation}`
                : ''}
              {ingredient.isOptional ? t('recipes.optionalSuffix') : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemoveIngredient(ingredient.id)}
            accessibilityLabel={t('a11y.removeNamed', {
              name: ingredient.name,
            })}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon name="close-circle" size={20} tone="error" />
          </Pressable>
        </AppPressable>
      ))}
      <AppPressable onPress={onAddIngredient} style={styles.addButton}>
        <Icon name="add-circle-outline" size={20} tone="primary" />
        <Text role="bodyStrong" tone="accent" style={styles.addText}>
          {t('recipes.addIngredient')}
        </Text>
      </AppPressable>
      {!!error && (
        <Text role="error" tone="error" style={styles.sectionError}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientMeta: {
    marginTop: 2,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  sectionError: {
    marginTop: theme.spacing.xs,
  },
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
