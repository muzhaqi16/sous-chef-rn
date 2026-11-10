import type { TutorialStep } from '#hooks/ui/useTutorialSequence';
import type { Translate } from '#/i18n/types';

/** What the account has done that Recipes' tips wait for. */
interface RecipeTipContext {
  hasSaved: () => boolean;
  hasOwnRecipe: () => boolean;
  hasPantryItems: () => boolean;
}

/**
 * Recipes' tips, each once the user has a reason for it: Saved after the
 * first save, My recipes after the first import or create, cooking with the
 * pantry once it holds something.
 */
export const getRecipeTutorialSteps = (
  t: Translate,
  { hasSaved, hasOwnRecipe, hasPantryItems }: RecipeTipContext,
): TutorialStep[] => [
  {
    featureId: 'recipe_tutorial_saved',
    title: t('recipes.savedRecipes'),
    subtitle: t('recipes.savedRecipesSubtitle'),
    rectKey: 'savedButton',
    when: hasSaved,
  },
  {
    featureId: 'recipe_tutorial_my_recipes',
    title: t('recipes.myRecipes'),
    subtitle: t('recipes.myRecipesSubtitle'),
    rectKey: 'myRecipesButton',
    when: hasOwnRecipe,
  },
  {
    featureId: 'recipe_tutorial_pantry',
    title: t('recipes.cookWithPantry'),
    subtitle: t('recipes.cookWithPantrySubtitle'),
    rectKey: 'pantryButton',
    when: hasPantryItems,
  },
];
