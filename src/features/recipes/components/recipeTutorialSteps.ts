import type { TutorialStep } from '#hooks/ui/useTutorialSequence';
import type { Translate } from '#/i18n/types';

export const getRecipeTutorialSteps = (t: Translate): TutorialStep[] => [
  {
    featureId: 'recipe_tutorial_saved',
    title: t('recipes.savedRecipes'),
    subtitle: t('recipes.savedRecipesSubtitle'),
    rectKey: 'savedButton',
  },
  {
    featureId: 'recipe_tutorial_my_recipes',
    title: t('recipes.myRecipes'),
    subtitle: t('recipes.myRecipesSubtitle'),
    rectKey: 'myRecipesButton',
  },
  {
    featureId: 'recipe_tutorial_dietary',
    title: t('recipes.dietaryRestrictions'),
    subtitle: t('recipes.dietaryRestrictionsSubtitle'),
    rectKey: 'dietaryButton',
  },
  {
    featureId: 'recipe_tutorial_pantry',
    title: t('recipes.cookWithPantry'),
    subtitle: t('recipes.cookWithPantrySubtitle'),
    rectKey: 'pantryButton',
  },
];
