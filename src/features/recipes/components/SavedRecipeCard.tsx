import React from 'react';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { SavedRecipeCard_SavedRecipeFragmentDoc } from './SavedRecipeCard.generated';
import { RecipeCardView, type RecipeCardAction } from './RecipeCardView';
import { recipeTotalMinutes } from '#features/recipes/utils/recipeTime';
import { useTranslation } from '#/i18n';

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
  const { t } = useTranslation();
  // Per-entity cache subscription: re-renders only when this SavedRecipe (or
  // its nested recipe scalars) change in the cache.
  const { data: saved, complete } = useFragment({
    fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
    fragmentName: 'SavedRecipeCard_savedRecipe',
    from: savedRecipeRef,
  });

  if (!complete) return null;
  // Null once the recipe is unpublished: the row stays so it can be removed.
  const { recipe, recipeId } = saved;

  const actions: RecipeCardAction[] = onRemove
    ? [
        {
          key: 'remove',
          icon: 'trash-outline',
          tone: 'error',
          labelKey: 'recipes.removeFromSavedA11y',
          onPress: () => onRemove(recipeId),
        },
      ]
    : [];

  return (
    <RecipeCardView
      name={recipe ? recipe.name : t('errors.codes.resourceGone')}
      imageUrl={recipe?.imageUrl}
      servings={recipe ? recipe.servings : null}
      totalMinutes={recipe ? recipeTotalMinutes(recipe) : null}
      onPress={() => onPress(recipeId)}
      actions={actions}
    />
  );
};
