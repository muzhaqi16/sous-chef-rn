import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeIngredientMatching } from '#features/recipes/hooks/useRecipeIngredientMatching';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import { logger } from '#/utils/environment';

interface UseRecipeCookingActionsOptions {
  recipeId: string | undefined;
}

interface MarkCookedInput {
  servings: number;
  deductFromPantry: boolean;
  useGranularDeduction: boolean;
  notes?: string;
}

interface FireMarkCookedVars {
  recipeId: string;
  servings?: number;
  deductFromPantry: boolean;
  notes?: string;
}

export function useRecipeCookingActions({
  recipeId,
}: UseRecipeCookingActionsOptions) {
  const { t } = useTranslation();
  const [cookedModalVisible, setCookedModalVisible] = useState(false);
  const [markingAsCooked, setMarkingAsCooked] = useState(false);

  const ingredientMatching = useRecipeIngredientMatching(recipeId);

  const [markRecipeAsCookedMutation] = useMutation(MarkRecipeAsCookedDocument);

  /**
   * Fire the cook-log mutation with a client-minted cooking-log id and queue it
   * locally when the API is unreachable (`localFirst`). The shared id means a
   * queued replay converges on the same cooking log instead of creating a
   * duplicate and re-deducting the pantry. Returns the classified outcome:
   * `'rejected'` means the server refused it (or the call threw); `'created'` /
   * `'queued'` both succeed (a queued cook replays later).
   */
  const fireMarkCooked = async (vars: FireMarkCookedVars) => {
    const id = generateEntityId();
    let result;
    try {
      result = await markRecipeAsCookedMutation({
        variables: { input: { ...vars, id } },
        context: { localFirst: true },
      });
    } catch (error) {
      // Report only — a throw classifies as 'rejected' below and every
      // caller toasts on that outcome; toasting here too would double up.
      errorService.reportError(error, { operation: 'markRecipeAsCooked' });
    }

    // Replay diagnostics: `converged: true` means this client-minted cooking-log
    // id already existed (an idempotent replay), not a fresh cook.
    const payload = result ? result.data?.markRecipeAsCooked : undefined;
    if (
      payload?.__typename === 'MarkRecipeAsCookedPayload' &&
      payload.converged
    ) {
      logger.info('markRecipeAsCooked converged — replay of a committed cook', {
        recipeId: vars.recipeId,
        cookingLogId: id,
      });
    }

    // A falsy result (the call threw) classifies as 'rejected'.
    return classifyCreateResult(result);
  };

  const handleMarkAsCooked = (input: MarkCookedInput) => {
    if (!recipeId) {
      toastService.error(t('recipes.cookExternalError'));
      return;
    }

    // Granular deduction: load ingredient matches and open review sheet
    if (input.useGranularDeduction) {
      executeWithLoadingState(async () => {
        const loaded = await ingredientMatching.loadMatches(input.servings);
        if (!loaded) {
          // Fallback to simple deduction if matching fails
          const outcome = await fireMarkCooked({
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          });
          if (outcome === 'rejected') {
            toastService.error(t('recipes.markCookedFailed'));
            return;
          }
          toastService.success(t('recipes.markedCookedDeducted'));
        }
      }, setMarkingAsCooked);
      return;
    }

    // Simple deduction path
    executeWithLoadingState(async () => {
      const outcome = await fireMarkCooked({
        recipeId,
        servings: input.servings,
        deductFromPantry: input.deductFromPantry,
        notes: input.notes,
      });
      if (outcome === 'rejected') {
        toastService.error(t('recipes.markCookedFailed'));
        return;
      }

      if (input.deductFromPantry) {
        toastService.success(t('recipes.markedCookedDeducted'));
      } else {
        toastService.success(t('recipes.markedCooked'));
      }
    }, setMarkingAsCooked);
  };

  // Skip review handler — falls back to simple markRecipeAsCooked with deductFromPantry: true
  const handleSkipReview = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    executeWithLoadingState(async () => {
      const outcome = await fireMarkCooked({
        recipeId,
        servings: undefined,
        deductFromPantry: true,
      });
      if (outcome === 'rejected') {
        toastService.error(t('recipes.markCookedFailed'));
        return;
      }
      toastService.success(t('recipes.markedCookedDeducted'));
    }, setMarkingAsCooked);
  };

  return {
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
    handleSkipReview,
    ingredientMatching,
  };
}
