import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
} from '@apollo/client/react';
import {
  MatchRecipeIngredientsToPantryDocument,
  MarkRecipeAsCookedDocument,
  type MatchRecipeIngredientsToPantryQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeIngredientFragmentDoc,
  type RecipeIngredientFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import {
  RecipeIngredientMatchKind,
  type IngredientUsageInput,
} from '#/graphql/generated/schemaTypes';
import { useSelectedPantryId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';

type IngredientMatch =
  MatchRecipeIngredientsToPantryQuery['matchRecipeIngredientsToPantry'][number];

/** What the cook entered before the review: the cooking log records it. */
export interface CookEntry {
  servings: number;
  notes?: string;
}

export type PantryStackOption = NonNullable<
  IngredientMatch['matchedPantryItem']
>;

export interface EditableMatch {
  match: IngredientMatch;
  /** Materialized RecipeIngredient fragment (id, isOptional, unit, …). The
   *  match's `ingredient` field is a masked fragment ref; we unmask once
   *  when building the editable so consumers can read fields directly. */
  ingredient: RecipeIngredientFragment;
  /** Every stack that could serve the ingredient, the server's pick first. */
  stackOptions: PantryStackOption[];
  /** The stack the deduction draws on: the server's pick until the user picks. */
  selectedStack: PantryStackOption | null;
  /** Null while the recipe states no amount and the cook has stated none. */
  adjustedQuantity: number | null;
  adjustedUnitId: string | null;
  isIncluded: boolean;
}

export type MatchUpdate = Partial<
  Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded' | 'selectedStack'>
>;

export interface MatchSummary {
  total: number;
  available: number;
  partial: number;
  missing: number;
  unsure: number;
  included: number;
}

type AvailabilityStatus = 'available' | 'partial' | 'missing' | 'unsure';

/**
 * `unsure` is a stack found by name only: it is offered, never deducted
 * until the user turns it on. `missing` is no stack, or an empty one.
 */
export function getAvailabilityStatus(
  match: IngredientMatch,
): AvailabilityStatus {
  const stack = match.matchedPantryItem;
  if (!stack) return 'missing';
  if (match.matchKind === RecipeIngredientMatchKind.Name) return 'unsure';
  if (match.isAvailable) return 'available';
  // `availableQuantity` is null when the recipe's unit cannot express the
  // stack (a loaf against a pound), so what the stack holds decides these two.
  if (stack.displayAmount.quantity > 0) return 'partial';
  return 'missing';
}

export function useRecipeIngredientMatching(recipeId: string | undefined) {
  const { t } = useTranslation();
  const pantryId = useSelectedPantryId();
  const client = useApolloClient();
  const [editableMatches, setEditableMatches] = useState<EditableMatch[]>([]);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const [loadMatchesQuery] = useLazyQuery(
    MatchRecipeIngredientsToPantryDocument,
    // Matches read current pantry stock, so a reopened flow must ask again;
    // a re-execute otherwise inherits the client's `cache-first`.
    {
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'network-only',
    },
  );

  // The reviewed cook is the quick cook's own write with `exactStacks`: one
  // transaction, so it deducts every stack stated or none.
  const [confirmMutation, { loading: confirmLoading }] = useMutation(
    MarkRecipeAsCookedDocument,
    { context: { localFirst: true } },
  );

  const loadMatches = async (servings: number) => {
    if (!recipeId || !pantryId) {
      toastService.error(t('recipes.recipeOrPantryUnavailable'));
      return false;
    }

    let result;
    try {
      result = await loadMatchesQuery({
        variables: { recipeId, pantryId, servings },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Load recipe matches error:',
      });
    }
    if (!result) return false;

    const matches = result.data?.matchRecipeIngredientsToPantry;
    // A read that failed (offline) is not an empty answer: the caller cooks
    // without the review instead.
    if (!matches) return false;
    if (matches.length === 0) {
      toastService.info(t('recipes.noIngredientsToMatch'));
      return false;
    }

    const editable: EditableMatch[] = matches
      .map((match): EditableMatch | null => {
        // The match query spreads RecipeIngredientFragment on `ingredient`, so
        // the cache is normally complete here (and Apollo merges writes — it
        // never shrinks an entity). A null therefore means the server returned
        // an ingredient missing a fragment field; surface it rather than
        // silently dropping the ingredient from the matching sheet.
        const ingredient = client.cache.readFragment<RecipeIngredientFragment>({
          fragment: RecipeIngredientFragmentDoc,
          fragmentName: 'RecipeIngredientFragment',
          from: match.ingredient,
        });
        if (!ingredient) {
          logger.warn(
            '[useRecipeIngredientMatching] incomplete RecipeIngredient in cache; dropping from matches',
            { recipeId, ingredientId: match.ingredient.id },
          );
          return null;
        }
        const status = getAvailabilityStatus(match);
        return {
          match,
          ingredient,
          stackOptions: match.matchedPantryItem
            ? [match.matchedPantryItem, ...match.alternativeMatches]
            : [],
          selectedStack: match.matchedPantryItem,
          adjustedQuantity: match.suggestedQuantity,
          adjustedUnitId:
            match.suggestedUnit?.id ?? ingredient.unit?.id ?? null,
          // An empty stack would only fail the deduction; picking another
          // stack includes the line. One stating no amount has nothing to
          // deduct until the cook states it.
          isIncluded:
            match.suggestedQuantity !== null &&
            !ingredient.isOptional &&
            (status === 'available' || status === 'partial'),
        };
      })
      .filter((m): m is EditableMatch => m !== null);

    setEditableMatches(editable);
    setIsSheetVisible(true);
    return true;
  };

  const updateMatch = (index: number, updates: MatchUpdate) => {
    setEditableMatches(prev => {
      const next = [...prev];
      const existing = next[index];
      if (!existing) return prev;
      next[index] = { ...existing, ...updates };
      return next;
    });
  };

  let available = 0;
  let partial = 0;
  let missing = 0;
  let unsure = 0;
  let included = 0;

  for (const em of editableMatches) {
    const status = getAvailabilityStatus(em.match);
    if (status === 'available') available++;
    else if (status === 'partial') partial++;
    else if (status === 'unsure') unsure++;
    else missing++;
    if (em.isIncluded) included++;
  }

  const matchSummary: MatchSummary = {
    total: editableMatches.length,
    available,
    partial,
    missing,
    unsure,
    included,
  };

  const confirmConsumption = async (cook?: CookEntry) => {
    if (!recipeId || !pantryId) return;

    const ingredientsUsed: IngredientUsageInput[] = editableMatches.flatMap(
      em => {
        const pantryItem = em.selectedStack;
        const quantity = em.adjustedQuantity;
        if (
          !em.isIncluded ||
          !pantryItem ||
          quantity === null ||
          quantity <= 0
        ) {
          return [];
        }
        return [
          {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: pantryItem.id,
            actualQuantity: quantity,
            actualUnitId:
              em.adjustedUnitId ??
              em.match.suggestedUnit?.id ??
              pantryItem.unit.id,
          },
        ];
      },
    );

    if (ingredientsUsed.length === 0) {
      toastService.info(t('recipes.noIngredientsForDeduction'));
      return;
    }

    // Mint the cooking-log id client-side and queue + replay (`localFirst`) when
    // the API is unreachable. The shared id means a re-synced cook converges on
    // the same cooking log instead of creating a duplicate and re-deducting.
    const settled = await settleMutation(
      () =>
        confirmMutation({
          variables: {
            input: {
              id: generateEntityId(),
              recipeId,
              pantryId,
              deductFromPantry: true,
              // Each entry draws on the stack it names and no other; an
              // ingredient with no entry is left alone.
              exactStacks: true,
              ingredientsUsed,
              servings: cook?.servings,
              notes: cook?.notes,
            },
          },
        }),
      {
        document: MarkRecipeAsCookedDocument,
        fallback: t('recipes.markCookedFailed'),
        // The review sheet reports the cook as a toast and stays open to retry.
        present: 'toast',
      },
    );
    // Applied and queued both succeed; a queued cook replays later.
    if (settled.failure) return;

    const data = appliedPayload(settled.data);
    // Replay diagnostics: `converged: true` means this client-minted cooking-log
    // id already existed (an idempotent replay), not a fresh cook.
    if (data?.converged) {
      logger.info('markRecipeAsCooked converged — replay of a reviewed cook', {
        recipeId,
      });
    }
    // The cook commits whole. What it reports apart are the entries no
    // conversion could take to their stack's unit; queued, every entry replays.
    const skippedCount = data?.skippedIngredients.length ?? 0;
    const deductedCount = ingredientsUsed.length - skippedCount;
    toastService.success(
      skippedCount > 0
        ? t('recipes.deductedFromPantryFailed', {
            count: deductedCount,
            failed: skippedCount,
          })
        : t('recipes.deductedFromPantry', { count: deductedCount }),
    );

    Telemetry.trackEvent('recipe_consumption_confirmed', {
      recipe_id: recipeId,
      pantry_id: pantryId,
      consumed_count: data ? deductedCount : 0,
      failed_count: skippedCount,
    });

    setIsSheetVisible(false);
    setEditableMatches([]);
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
  };

  return {
    loadMatches,
    editableMatches,
    updateMatch,
    matchSummary,
    confirmConsumption,
    confirmLoading,
    isSheetVisible,
    closeSheet,
    hasPantry: !!pantryId,
  };
}
