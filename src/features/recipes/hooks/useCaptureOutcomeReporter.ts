import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { TOAST } from '#constants/animations';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { forgetMyRecipesLists } from '#features/recipes/utils/recipeCacheWriters';
import type { CaptureOutcome } from '#features/recipes/utils/recipeCaptureOutcome';
import { useRecipeCaptureActions } from '#features/recipes/store/recipeCaptureStore';

/**
 * Tells the user how a capture ended, from whichever tab they are on: a saved
 * recipe to open, a partial read to finish, or why nothing was read.
 */
export function useCaptureOutcomeReporter() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { toRecipeDetail, toRecipeCreate } = useAppNavigation();
  const { settle, markIncomplete } = useRecipeCaptureActions();

  return (captureId: string, outcome: CaptureOutcome) => {
    switch (outcome.kind) {
      case 'saved': {
        const { recipe } = outcome;
        settle(captureId, recipe?.id);
        if (!outcome.alreadySaved) forgetMyRecipesLists(client.cache);
        if (!recipe) return;
        toastService.success(
          t(
            outcome.alreadySaved
              ? 'recipes.captureAlreadySaved'
              : 'recipes.captureSaved',
            { name: recipe.name },
          ),
          {
            duration: TOAST.AUTO_DISMISS_LONG,
            action: {
              label: t('labels.open'),
              onPress: () => toRecipeDetail({ recipeId: recipe.id }),
            },
          },
        );
        return;
      }
      case 'incomplete':
        // Kept as a row to finish: a missed toast must not lose the draft.
        markIncomplete(captureId);
        toastService.info(t('recipes.captureIncomplete'), {
          duration: TOAST.AUTO_DISMISS_LONG,
          action: {
            label: t('recipes.captureFinish'),
            onPress: () => toRecipeCreate({ captureId }),
          },
        });
        return;
      case 'failed':
        settle(captureId);
        toastService.error(t(outcome.copy), {
          duration: TOAST.AUTO_DISMISS_LONG,
        });
    }
  };
}
