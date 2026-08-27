import React from 'react';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { MyRecipeCard_RecipeFragmentDoc } from './MyRecipeCard.generated';
import { RecipeCardView, type RecipeCardAction } from './RecipeCardView';
import { recipeTotalMinutes } from '#features/recipes/utils/recipeTime';

interface MyRecipeCardProps {
  recipeRef: FragmentType<typeof MyRecipeCard_RecipeFragmentDoc>;
  onPress: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const MyRecipeCard: React.FC<MyRecipeCardProps> = ({
  recipeRef,
  onPress,
  onEdit,
  onDelete,
}) => {
  // Per-entity cache subscription: this card re-renders only when this Recipe's
  // MyRecipeCard_recipe fields change.
  const { data: recipe, complete } = useFragment({
    fragment: MyRecipeCard_RecipeFragmentDoc,
    fragmentName: 'MyRecipeCard_recipe',
    from: recipeRef,
  });

  if (!complete) return null;

  const actions: RecipeCardAction[] = [];
  if (onEdit) {
    actions.push({
      key: 'edit',
      icon: 'create-outline',
      tone: 'textSecondary',
      labelKey: 'recipes.editRecipeA11y',
      onPress: () => onEdit(recipe.id),
    });
  }
  if (onDelete) {
    actions.push({
      key: 'delete',
      icon: 'trash-outline',
      tone: 'error',
      labelKey: 'recipes.deleteRecipeA11y',
      onPress: () => onDelete(recipe.id),
    });
  }

  return (
    <RecipeCardView
      name={recipe.name}
      imageUrl={recipe.imageUrl}
      servings={recipe.servings}
      totalMinutes={recipeTotalMinutes(recipe)}
      onPress={() => onPress(recipe.id)}
      actions={actions}
    />
  );
};
