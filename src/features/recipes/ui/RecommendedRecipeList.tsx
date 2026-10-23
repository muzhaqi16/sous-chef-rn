import React from 'react';
import { RecommendedRecipeCard } from './RecommendedRecipeCard';
import {
  RECOMMENDED_RECIPES_SHOWN,
  useRecommendedRecipes,
} from './useRecommendedRecipes';

interface RecommendedRecipe {
  id: string;
  name: string;
  /** Its coverage when it was recommended, 0–100. */
  matchPercentage: number | null;
}

interface RecommendedRecipeListProps {
  recipes: readonly RecommendedRecipe[];
  /** Shown instead when every recipe is gone. */
  fallback: React.ReactNode;
}

/**
 * A notification's recommended recipes as cards, each as it is now. A recipe
 * the API says is gone is left out; one it could not read keeps the name and
 * coverage it was recommended with.
 */
export const RecommendedRecipeList: React.FC<RecommendedRecipeListProps> = ({
  recipes,
  fallback,
}) => {
  const shown = recipes.slice(0, RECOMMENDED_RECIPES_SHOWN);
  const readings = useRecommendedRecipes(shown.map(recipe => recipe.id));
  const cards = shown.flatMap((recommended, at) => {
    const reading = readings[at];
    return reading?.gone ? [] : [{ ...recommended, recipe: reading?.recipe }];
  });
  if (cards.length === 0) return fallback;

  return cards.map(card => (
    <RecommendedRecipeCard
      key={card.id}
      recipeId={card.id}
      recipe={card.recipe}
      name={card.name}
      matchPercentage={card.matchPercentage}
    />
  ));
};
