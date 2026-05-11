import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
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
  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.sectionTitle}>
        Ingredients ({ingredients.length})
      </Text>

      {ingredients.map(ingredient => (
        <Pressable
          key={ingredient.id}
          onPress={() => onEditIngredient(ingredient)}
          style={({ pressed }) => [
            styles.ingredientRow,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.ingredientInfo}>
            <Text size="md" weight="medium">
              {ingredient.name || 'Unnamed ingredient'}
            </Text>
            <Text size="sm" tone="secondary" style={styles.ingredientMeta}>
              {ingredient.quantity}
              {ingredient.preparation
                ? ` \u00B7 ${ingredient.preparation}`
                : ''}
              {ingredient.isOptional ? ' (optional)' : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemoveIngredient(ingredient.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon
              name="close-circle"
              size={20}
              color={styles.removeIcon.color}
            />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        onPress={onAddIngredient}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon
          name="add-circle-outline"
          size={20}
          color={styles.addIcon.color}
        />
        <Text size="md" weight="medium" tone="accent" style={styles.addText}>
          Add Ingredient
        </Text>
      </Pressable>
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
  removeIcon: {
    color: theme.colors.error,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: theme.spacing.sm,
  },
  addIcon: {
    color: theme.colors.primary,
  },
  addText: {
    marginLeft: theme.spacing.sm,
  },
}));
