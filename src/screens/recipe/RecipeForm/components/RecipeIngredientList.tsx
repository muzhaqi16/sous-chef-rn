import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { IngredientFormState } from '../useRecipeForm';

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
      <Text style={styles.sectionTitle}>
        Ingredients ({ingredients.length})
      </Text>

      {ingredients.map(ingredient => (
        <Pressable
          key={ingredient.id}
          onPress={() => onEditIngredient(ingredient)}
          style={({ pressed }) => [styles.ingredientRow, pressed && styles.pressed]}
        >
          <View style={styles.ingredientInfo}>
            <Text style={styles.ingredientName}>
              {ingredient.name || 'Unnamed ingredient'}
            </Text>
            <Text style={styles.ingredientMeta}>
              {ingredient.quantity}
              {ingredient.preparation ? ` \u00B7 ${ingredient.preparation}` : ''}
              {ingredient.isOptional ? ' (optional)' : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemoveIngredient(ingredient.id)}
            hitSlop={8}
            style={styles.removeButton}
          >
            <Icon library="Ionicons" name="close-circle" size={20} color={styles.removeIcon.color} />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        onPress={onAddIngredient}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon library="Ionicons" name="add-circle-outline" size={20} color={styles.addIcon.color} />
        <Text style={styles.addText}>Add Ingredient</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
  ingredientName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  ingredientMeta: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
}));
