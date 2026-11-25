import { useState } from 'react';
import { useTranslation } from '#i18n';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import {
  plannedMealInput,
  plannedMealSettle,
  useRecipeIngredientMatching,
  type CookContext,
  type CookEntry,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { toastService } from '#services/toastService';
import { executeWithLoadingState } from '#utils/finallyHelpers';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { CookRecipeInputs } from '#features/recipes/offline/localWrites';
import { emitTutorialEvent } from '#domain/tutorialEvents';
import { askForReviewAfterSuccess } from '#domain/reviewPrompt';
import { generateEntityId } from '#utils/generateEntityId';
import { appliedPayload } from '#utils/errors/mutationPayload';
import { ErrorCode } from '#graphql/generated/schemaTypes';
import { logger } from '#utils/environment';
import { useSelectedPantryId } from '#store/useAppStore';
import { cappedNames } from '#utils/cappedNames';
import type { CookConfirmOutcome } from '#features/recipes/types';

interface UseRecipeCookingActionsOptions extends CookContext {
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

/**
 * The one way a recipe is cooked, from its detail or from a planned meal: a
 * planned meal's cook completes it in the same write, so it is cooked once.
 */
export function useRecipeCookingActions({
  recipeId,
  plannedMeal,
  onMealChanged,
}: UseRecipeCookingActionsOptions) {
  const { t } = useTranslation();
  const [cookedModalVisible, setCookedModalVisible] = useState(false);
  const [markingAsCooked, setMarkingAsCooked] = useState(false);
  // A confirm or a skip of the review records it.
  const [reviewedCook, setReviewedCook] = useState<CookEntry | null>(null);

  const ingredientMatching = useRecipeIngredientMatching(recipeId, {
    plannedMeal,
    onMealChanged,
  });
  const pantryId = useSelectedPantryId();

  const markCooked = useLocalWrite(MarkRecipeAsCookedDocument, {
    fallback: t('recipes.markCookedFailed'),
    present: 'toast',
    ...plannedMealSettle(t, { plannedMeal, onMealChanged }),
  });

  /**
   * Logs the cook under a minted id, so a replay cannot re-deduct the pantry.
   * `failure` is shown for a refused or failed write; `skipped` names
   * ingredients NOT deducted, which a bare success toast hides.
   */
  const fireMarkCooked = async (vars: FireMarkCookedVars) => {
    const id = generateEntityId();
    // The server picks the stacks, so the device draws none until it answers.
    const inputs: CookRecipeInputs = {
      draws: [],
      now: new Date().toISOString(),
      ...(plannedMeal && { meal: { id: plannedMeal.id, cookingLogId: id } }),
    };
    const settled = await markCooked.send(
      {
        input: {
          ...vars,
          ...deductingFrom(vars.deductFromPantry, pantryId),
          ...plannedMealInput(plannedMeal),
          id,
        },
      },
      inputs,
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

    if (settled.status !== 'failed') {
      emitTutorialEvent('recipe.cooked');
      askForReviewAfterSuccess();
    }
    return {
      failure: settled.failure,
      queued: settled.status === 'queued',
      skipped,
      // The stacks it recorded a draw on: a draw stops at what a stack holds,
      // and an ingredient no stack serves draws nothing and is not skipped.
      drawn: new Set(
        (payload?.cookingLog.pantryItemsUsedConnection.edges ?? []).map(
          // A stack deleted since still counts as drawn on.
          ({ node }) => node.pantryItem?.id ?? node.id,
        ),
      ).size,
    };
  };

  /** A queued cook is not taken yet: it says so, never that it deducted. */
  const queuedToast = (deducting: boolean) =>
    toastService.info(
      t(deducting ? 'recipes.cookedQueued' : 'recipes.cookedQueuedNotDeducted'),
    );

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

  /**
   * What a deducting cook recorded, never what it asked for: the lines it
   * skipped, else how many stacks it drew on, or that it drew on none.
   */
  const deductionToast = (skipped: SkippedDeductions, drawn: number) => {
    if (skipped.count > 0) {
      toastService.warning(skippedCopy(skipped));
      return;
    }
    toastService.success(
      drawn > 0
        ? t('recipes.markedCookedDeducted', { count: drawn })
        : t('recipes.markedCookedNotDeducted'),
    );
  };

  /** Records the cook as entered, deducting or not; the sheet waits for it. */
  const cookAsEntered = async (
    vars: FireMarkCookedVars,
  ): Promise<CookConfirmOutcome> => {
    const { failure, queued, skipped, drawn } = await fireMarkCooked(vars);
    // Refused: the sheet keeps what was entered, under the failure toast.
    if (failure) return 'retry';
    if (queued) queuedToast(vars.deductFromPantry);
    else if (vars.deductFromPantry) deductionToast(skipped, drawn);
    else toastService.success(t('recipes.markedCooked'));
    return 'done';
  };

  /**
   * A cook asking for the review deducts only what the review confirms: one
   * the review cannot be read for stays open with the review turned off, to be
   * confirmed again; a recipe with nothing to draw is recorded as cooked.
   */
  const cookAfterReview = async (
    recipe: string,
    input: MarkCookedInput,
  ): Promise<CookConfirmOutcome> => {
    setReviewedCook({ servings: input.servings, notes: input.notes });
    const review = await ingredientMatching.loadMatches(input.servings);
    if (review === 'loaded') return 'done';
    if (review === 'unavailable') return 'reviewUnavailable';
    return recordWithoutDeducting(recipe, input);
  };

  /** The cook alone, saying the pantry was left as it was. */
  const recordWithoutDeducting = async (
    recipe: string,
    cook: CookEntry | null,
  ): Promise<CookConfirmOutcome> => {
    const { failure, queued } = await fireMarkCooked({
      recipeId: recipe,
      servings: cook?.servings,
      deductFromPantry: false,
      notes: cook?.notes,
    });
    if (failure) return 'retry';
    if (queued) queuedToast(false);
    else toastService.success(t('recipes.markedCookedNotDeducted'));
    return 'done';
  };

  const handleMarkAsCooked = async (
    input: MarkCookedInput,
  ): Promise<CookConfirmOutcome> => {
    if (!recipeId) {
      toastService.error(t('recipes.cookExternalError'));
      return 'done';
    }
    let outcome: CookConfirmOutcome = 'retry';
    await executeWithLoadingState(async () => {
      outcome = input.useGranularDeduction
        ? await cookAfterReview(recipeId, input)
        : await cookAsEntered({
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          });
    }, setMarkingAsCooked);
    return outcome;
  };

  // Skipping the review lets the server pick the stacks (markRecipeAsCooked).
  const handleSkipReview = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    void executeWithLoadingState(async () => {
      const { failure, queued, skipped, drawn } = await fireMarkCooked({
        recipeId,
        servings: reviewedCook?.servings,
        deductFromPantry: true,
        notes: reviewedCook?.notes,
      });
      if (failure) return;
      if (queued) queuedToast(true);
      else deductionToast(skipped, drawn);
    }, setMarkingAsCooked);
  };

  const handleConfirmReview = () =>
    ingredientMatching.confirmConsumption(reviewedCook ?? undefined);

  // A review with nothing to draw still records the cook, and says the pantry
  // was left as it was.
  const handleRecordWithoutDeducting = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    void executeWithLoadingState(async () => {
      await recordWithoutDeducting(recipeId, reviewedCook);
    }, setMarkingAsCooked);
  };

  return {
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
    handleSkipReview,
    handleConfirmReview,
    handleRecordWithoutDeducting,
    ingredientMatching,
  };
}
