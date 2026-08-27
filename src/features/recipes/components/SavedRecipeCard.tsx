import React from 'react';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { SavedRecipeCard_SavedRecipeFragmentDoc } from './SavedRecipeCard.generated';
import { RecipeCardView, type RecipeCardAction } from './RecipeCardView';
import { recipeTotalMinutes } from '#features/recipes/utils/recipeTime';

interface SavedRecipeCardProps {
  savedRecipeRef: FragmentType<typeof SavedRecipeCard_SavedRecipeFragmentDoc>;
  onPress: (recipeId: string) => void;
  onRemove?: (recipeId: string) => void;
}

export const SavedRecipeCard: React.FC<SavedRecipeCardProps> = ({
  savedRecipeRef,
  onPress,
  onRemove,
}) => {
  // Per-entity cache subscription: re-renders only when this SavedRecipe (or
  // its nested recipe scalars) change in the cache.
  const { data: saved, complete } = useFragment({
    fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeCard_savedRecipe',
    from: savedRecipeRef,
  });

  if (!complete) return null;
  const recipe = saved.recipe;

  const actions: RecipeCardAction[] = onRemove
    ? [
        {
          key: 'remove',
          icon: 'trash-outline',
          tone: 'error',
          labelKey: 'recipes.removeFromSavedA11y',
          onPress: () => onRemove(recipe.id),
        },
      ]
    : [];

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
