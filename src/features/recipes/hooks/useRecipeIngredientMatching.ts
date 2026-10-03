import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
} from '@apollo/client/react';
import {
  MatchRecipeIngredientsToPantryDocument,
  ConfirmRecipeConsumptionDocument,
  type MatchRecipeIngredientsToPantryQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeIngredientFragmentDoc,
  type RecipeIngredientFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import type { ConfirmedIngredientConsumptionInput } from '#/graphql/generated/schemaTypes';
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
  adjustedQuantity: number;
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

/** Below this the server matched by name alone ("olives" finds "Kalamata Olives"). */
const CONFIDENT_MATCH = 0.8;

/**
 * `unsure` is a stack found by name only: it is offered, never deducted
 * until the user turns it on. `missing` is no stack, or an empty one.
 */
export function getAvailabilityStatus(
  match: IngredientMatch,
): AvailabilityStatus {
  const stack = match.matchedPantryItem;
  if (!stack) return 'missing';
  if (match.matchConfidence < CONFIDENT_MATCH) return 'unsure';
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

  const [confirmMutation, { loading: confirmLoading }] = useMutation(
    ConfirmRecipeConsumptionDocument,
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
    if (!matches || matches.length === 0) {
      toastService.info(t('recipes.noIngredientsToMatch'));
      return false;
    }

    const editable: EditableMatch[] = matches
      .map(match => {
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
          // stack includes the line.
          isIncluded:
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

  /** `cook` is what the cook entered before the review: the log records it. */
  const confirmConsumption = async (cook?: {
    servings: number;
    notes?: string;
  }) => {
    if (!recipeId || !pantryId) return;

    const consumptions: ConfirmedIngredientConsumptionInput[] =
      editableMatches.flatMap(em => {
        const pantryItem = em.selectedStack;
        if (!em.isIncluded || !pantryItem || em.adjustedQuantity <= 0) {
          return [];
        }
        return [
          {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: pantryItem.id,
            quantity: em.adjustedQuantity,
            unitId:
              em.adjustedUnitId ??
              em.match.suggestedUnit?.id ??
              pantryItem.unit.id,
          },
        ];
      });

    if (consumptions.length === 0) {
      toastService.info(t('recipes.noIngredientsForDeduction'));
      return;
    }

    // Mint the cooking-log id client-side and queue + replay (`localFirst`) when
    // the API is unreachable. The shared id means a re-synced consumption
    // converges on the same cooking log instead of creating a duplicate and
    // re-consuming the pantry.
    const settled = await settleMutation(
      () =>
        confirmMutation({
          variables: {
            input: {
              id: generateEntityId(),
              recipeId,
              pantryId,
              consumptions,
              servings: cook?.servings,
              notes: cook?.notes,
            },
          },
        }),
      {
        document: ConfirmRecipeConsumptionDocument,
        fallback: t('recipes.markCookedFailed'),
        // The review sheet reports the cook as a toast and stays open to retry.
        present: 'none',
      },
    );
    // Applied and queued both succeed; a queued consumption replays later.
    if (settled.failure) {
      toastService.error(settled.failure.body);
      return;
    }

    // The success union member carries no `success` flag — reaching it IS the
    // success case; partial failures surface via `totalFailed`.
    const data = appliedPayload(settled.data);
    // Replay diagnostics: `converged: true` means this whole confirmation had
    // already committed (idempotent replay). A fresh commit — including one
    // that healed leftover items from a partially-crashed earlier attempt —
    // reports false, so only `true` is logged.
    if (data?.converged) {
      logger.info(
        'confirmRecipeConsumption converged — replay of a committed confirmation',
        { recipeId },
      );
    }
    if (data) {
      toastService.success(
        data.totalFailed > 0
          ? t('recipes.deductedFromPantryFailed', {
              count: data.totalConsumed,
              failed: data.totalFailed,
            })
          : t('recipes.deductedFromPantry', { count: data.totalConsumed }),
      );
    } else {
      // Queued offline — no response yet; show the optimistic count (every
      // included consumption replays on reconnect).
      toastService.success(
        t('recipes.deductedFromPantry', { count: consumptions.length }),
      );
    }

    Telemetry.trackEvent('recipe_consumption_confirmed', {
      recipe_id: recipeId,
      pantry_id: pantryId,
      consumed_count: data?.totalConsumed ?? 0,
      failed_count: data?.totalFailed ?? 0,
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
