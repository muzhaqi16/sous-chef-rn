import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import {
  useRecipeIngredientMatching,
  type CookEntry,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { askForReviewAfterSuccess } from '#/domain/reviewPrompt';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { useSelectedPantryId } from '#store/useAppStore';
import { cappedNames } from '#/utils/cappedNames';

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

/** The pantry a deducting cook draws on; omitted, the server picks a default. */
const deductingFrom = (
  deductFromPantry: boolean,
  pantryId: string | null | undefined,
) => (deductFromPantry && pantryId ? { pantryId } : {});

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
  // A confirm or a skip of the review records it.
  const [reviewedCook, setReviewedCook] = useState<CookEntry | null>(null);

  const ingredientMatching = useRecipeIngredientMatching(recipeId);
  const pantryId = useSelectedPantryId();

  const [markRecipeAsCookedMutation] = useMutation(MarkRecipeAsCookedDocument, {
    context: { localFirst: true },
  });

  /**
   * Logs the cook under a minted id, so a replay cannot re-deduct the pantry.
   * `failure` is shown for a refused or failed write; `skipped` names
   * ingredients NOT deducted, which a bare success toast hides.
   */
  const fireMarkCooked = async (vars: FireMarkCookedVars) => {
    const id = generateEntityId();
    const settled = await settleMutation(
      () =>
        markRecipeAsCookedMutation({
          variables: {
            input: {
              ...vars,
              ...deductingFrom(vars.deductFromPantry, pantryId),
              id,
            },
          },
        }),
      {
        document: MarkRecipeAsCookedDocument,
        fallback: t('recipes.markCookedFailed'),
        present: 'toast',
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

    // A line stating no amount ("salt, to taste") has nothing to deduct, so
    // its skip is the recipe as written, not something for the user to fix.
    const skippedIngredients = (payload?.skippedIngredients ?? []).filter(
      item => item.code !== ErrorCode.UnstatedAmount,
    );
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

    if (settled.status !== 'failed') askForReviewAfterSuccess();
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
    const { shown, remainder } = cappedNames(names, count);
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
      setReviewedCook({ servings: input.servings, notes: input.notes });
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
          if (failure) return;
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
      if (failure) return;

      if (input.deductFromPantry) {
        deductionToast(skipped);
      } else {
        toastService.success(t('recipes.markedCooked'));
      }
    }, setMarkingAsCooked);
  };

  // Skipping the review lets the server pick the stacks (markRecipeAsCooked).
  const handleSkipReview = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    void executeWithLoadingState(async () => {
      const { failure, skipped } = await fireMarkCooked({
        recipeId,
        servings: reviewedCook?.servings,
        deductFromPantry: true,
        notes: reviewedCook?.notes,
      });
      if (failure) return;
      deductionToast(skipped);
    }, setMarkingAsCooked);
  };

  const handleConfirmReview = () =>
    ingredientMatching.confirmConsumption(reviewedCook ?? undefined);

  return {
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
    handleSkipReview,
    handleConfirmReview,
    ingredientMatching,
  };
}
