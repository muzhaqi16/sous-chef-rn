import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { IngredientFormState } from '../useRecipeForm';
import { Text } from '#components/atoms/Text';

interface RecipeIngredientListProps {
  ingredients: IngredientFormState[];
  onEditIngredient: (ingredient: IngredientFormState) => void;
  onRemoveIngredient: (id: string) => void;
  onAddIngredient: () => void;
}

export const RecipeIngredientList: React.FC<RecipeIngredientListProps> = ({
  ingredients,
  onEditIngredient,
  onRemoveIngredient,
  onAddIngredient,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        {t('recipes.ingredientsCount', { count: ingredients.length })}
      </Text>
      {ingredients.map(ingredient => (
        <AppPressable
          key={ingredient.id}
          onPress={() => onEditIngredient(ingredient)}
          style={styles.ingredientRow}
        >
          <View style={styles.ingredientInfo}>
            <Text size="md" weight="medium">
              {ingredient.name || t('recipes.unnamedIngredient')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.ingredientMeta}>
              {ingredient.quantity}
              {ingredient.preparation
                ? ` \u00B7 ${ingredient.preparation}`
                : ''}
              {ingredient.isOptional ? t('recipes.optionalSuffix') : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemoveIngredient(ingredient.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon name="close-circle" size={20} tone="error" />
          </Pressable>
        </AppPressable>
      ))}
      <AppPressable onPress={onAddIngredient} style={styles.addButton}>
        <Icon name="add-circle-outline" size={20} tone="primary" />
        <Text size="md" weight="medium" tone="accent" style={styles.addText}>
          {t('recipes.addIngredient')}
        </Text>
      </AppPressable>
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
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
