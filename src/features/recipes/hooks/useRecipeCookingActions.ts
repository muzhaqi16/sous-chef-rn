import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeIngredientMatching } from '#features/recipes/hooks/useRecipeIngredientMatching';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
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

/** Names shown before the rest become a count, as the expiry digest does. */
const SKIPPED_NAME_CAP = 3;

/** What the cook left undeducted, and whether one cause covers all of it. */
interface SkippedDeductions {
  count: number;
  names: string[];
  allUnitConversion: boolean;
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
   * Fires the cook-log mutation with a client-minted id, so a queued replay
   * converges on the same log instead of re-deducting the pantry. `failure` is
   * the message a refused or failed write shows; `skipped` describes the
   * ingredients NOT deducted, which a bare success toast would hide.
   */
  const fireMarkCooked = async (vars: FireMarkCookedVars) => {
    const id = generateEntityId();
    const settled = await settleMutation(
      () =>
        markRecipeAsCookedMutation({
          variables: { input: { ...vars, id } },
          context: { localFirst: true },
        }),
      {
        document: MarkRecipeAsCookedDocument,
        fallback: t('recipes.markCookedFailed'),
        // Every caller reports the cook as a toast.
        present: 'none',
      },
    );

    // Replay diagnostics: `converged: true` means this client-minted cooking-log
    // id already existed (an idempotent replay), not a fresh cook.
    const payload = appliedPayload(settled.data);
    if (payload?.converged) {
      logger.info('markRecipeAsCooked converged — replay of a committed cook', {
        recipeId: vars.recipeId,
        cookingLogId: id,
      });
    }

    const skippedIngredients = payload?.skippedIngredients ?? [];
    const skipped = {
      count: skippedIngredients.length,
      // Which lines, so the user knows what to fix. A blank name would read as
      // a gap in the list, so it drops out and the count still covers it.
      names: skippedIngredients
        .map(item => item.itemName)
        .filter(name => name.trim() !== ''),
      // The one cause the copy can name: no conversion reaches the stack's
      // unit. Reported only when it accounts for EVERY skip, since a mixed
      // batch has no single reason to state.
      allUnitConversion:
        skippedIngredients.length > 0 &&
        skippedIngredients.every(item => item.code === ErrorCode.UnitInvalid),
    };

    return { failure: settled.failure, skipped };
  };

  /**
   * What the cook left undeducted: the lines by name, and the cause when one
   * accounts for all of them. Falls back to the count where no name survived.
   */
  const skippedCopy = ({
    count,
    names,
    allUnitConversion,
  }: SkippedDeductions): string => {
    if (names.length === 0) {
      return t(
        allUnitConversion
          ? 'recipes.markedCookedSkippedUnit'
          : 'recipes.markedCookedSkipped',
        { count },
      );
    }
    const shown = names.slice(0, SKIPPED_NAME_CAP).join(', ');
    const remainder = count - Math.min(SKIPPED_NAME_CAP, names.length);
    if (remainder > 0) {
      return t(
        allUnitConversion
          ? 'recipes.markedCookedSkippedUnitNamesMore'
          : 'recipes.markedCookedSkippedNamesMore',
        { names: shown, count: remainder },
      );
    }
    return t(
      allUnitConversion
        ? 'recipes.markedCookedSkippedUnitNames'
        : 'recipes.markedCookedSkippedNames',
      { names: shown, count },
    );
  };

  /** Success copy that says so only when nothing was left undeducted. */
  const deductionToast = (skipped: SkippedDeductions) => {
    if (skipped.count > 0) {
      toastService.warning(skippedCopy(skipped));
      return;
    }
    toastService.success(t('recipes.markedCookedDeducted'));
  };

  const handleMarkAsCooked = (input: MarkCookedInput) => {
    if (!recipeId) {
      toastService.error(t('recipes.cookExternalError'));
      return;
    }

    // Granular deduction: load ingredient matches and open review sheet
    if (input.useGranularDeduction) {
      void executeWithLoadingState(async () => {
        const loaded = await ingredientMatching.loadMatches(input.servings);
        if (!loaded) {
          // Fallback to simple deduction if matching fails
          const { failure, skipped } = await fireMarkCooked({
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          });
          if (failure) {
            toastService.error(failure.body);
            return;
          }
          deductionToast(skipped);
        }
      }, setMarkingAsCooked);
      return;
    }

    // Simple deduction path
    void executeWithLoadingState(async () => {
      const { failure, skipped } = await fireMarkCooked({
        recipeId,
        servings: input.servings,
        deductFromPantry: input.deductFromPantry,
        notes: input.notes,
      });
      if (failure) {
        toastService.error(failure.body);
        return;
      }

      if (input.deductFromPantry) {
        deductionToast(skipped);
      } else {
        toastService.success(t('recipes.markedCooked'));
      }
    }, setMarkingAsCooked);
  };

  // Skip review handler — falls back to simple markRecipeAsCooked with deductFromPantry: true
  const handleSkipReview = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    void executeWithLoadingState(async () => {
      const { failure, skipped } = await fireMarkCooked({
        recipeId,
        servings: undefined,
        deductFromPantry: true,
      });
      if (failure) {
        toastService.error(failure.body);
        return;
      }
      deductionToast(skipped);
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
