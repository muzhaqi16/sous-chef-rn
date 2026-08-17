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
import { type ConfirmedIngredientConsumptionInput } from '#/graphql/generated/schemaTypes';
import { useSelectedPantryId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import { handleMutationError } from '#/utils/errorHandlers';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';

type IngredientMatch =
  MatchRecipeIngredientsToPantryQuery['matchRecipeIngredientsToPantry'][number];

export interface EditableMatch {
  match: IngredientMatch;
  /** Materialized RecipeIngredient fragment (id, isOptional, unit, …). The
   *  match's `ingredient` field is a masked fragment ref; we unmask once
   *  when building the editable so consumers can read fields directly. */
  ingredient: RecipeIngredientFragment;
  adjustedQuantity: number;
  adjustedUnitId: string | null;
  isIncluded: boolean;
}

export interface MatchSummary {
  total: number;
  available: number;
  partial: number;
  missing: number;
  included: number;
}

type AvailabilityStatus = 'available' | 'partial' | 'missing';

export function getAvailabilityStatus(
  match: IngredientMatch,
): AvailabilityStatus {
  if (match.isAvailable && match.matchConfidence >= 0.8) return 'available';
  if (
    match.matchedPantryItem &&
    !match.isAvailable &&
    match.availableQuantity > 0
  )
    return 'partial';
  return 'missing';
}

export function useRecipeIngredientMatching(recipeId: string | undefined) {
  const { t } = useTranslation();
  const pantryId = useSelectedPantryId();
  const client = useApolloClient();
  const [editableMatches, setEditableMatches] = useState<EditableMatch[]>([]);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const [loadMatchesQuery, { loading: matchesLoading }] = useLazyQuery(
    MatchRecipeIngredientsToPantryDocument,
    {
      fetchPolicy: 'network-only',
    },
  );

  const [confirmMutation, { loading: confirmLoading }] = useMutation(
    ConfirmRecipeConsumptionDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Confirm Recipe Consumption' });
      },
    },
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
        return {
          match,
          ingredient,
          adjustedQuantity: match.suggestedQuantity,
          adjustedUnitId:
            match.suggestedUnit?.id ?? ingredient.unit?.id ?? null,
          isIncluded: !ingredient.isOptional && !!match.matchedPantryItem,
        };
      })
      .filter((m): m is EditableMatch => m !== null);

    setEditableMatches(editable);
    setIsSheetVisible(true);
    return true;
  };

  const updateMatch = (
    index: number,
    updates: Partial<
      Pick<EditableMatch, 'adjustedQuantity' | 'adjustedUnitId' | 'isIncluded'>
    >,
  ) => {
    setEditableMatches(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  let available = 0;
  let partial = 0;
  let missing = 0;
  let included = 0;

  for (const em of editableMatches) {
    const status = getAvailabilityStatus(em.match);
    if (status === 'available') available++;
    else if (status === 'partial') partial++;
    else missing++;
    if (em.isIncluded) included++;
  }

  const matchSummary: MatchSummary = {
    total: editableMatches.length,
    available,
    partial,
    missing,
    included,
  };

  const confirmConsumption = async () => {
    if (!recipeId || !pantryId) return;

    const consumptions: ConfirmedIngredientConsumptionInput[] = editableMatches
      .filter(em => em.isIncluded && em.match.matchedPantryItem)
      .map(em => ({
        recipeIngredientId: em.ingredient.id,
        pantryItemId: em.match.matchedPantryItem!.id,
        quantity: em.adjustedQuantity,
        unitId:
          em.adjustedUnitId ||
          em.match.suggestedUnit?.id ||
          em.match.matchedPantryItem!.unit?.id ||
          '',
      }));

    if (consumptions.length === 0) {
      toastService.info(t('recipes.noIngredientsForDeduction'));
      return;
    }

    // Mint the cooking-log id client-side and queue + replay (`localFirst`) when
    // the API is unreachable. The shared id means a re-synced consumption
    // converges on the same cooking log instead of creating a duplicate and
    // re-consuming the pantry.
    let result;
    try {
      result = await confirmMutation({
        variables: {
          input: { id: generateEntityId(), recipeId, pantryId, consumptions },
        },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Confirm recipe consumption error:',
      });
    }
    if (!result) return;

    // A resolved refusal (error union member / transport error) under
    // errorPolicy:'all' RESOLVES rather than throws — bail before the success
    // toast / sheet-close. 'created' and 'queued' both succeed (a queued
    // consumption replays later).
    if (classifyCreateResult(result) === 'rejected') {
      toastService.error(t('recipes.markCookedFailed'));
      return;
    }

    const payload = result.data?.confirmRecipeConsumption;
    // The success union member no longer carries a `success` flag — reaching it
    // IS the success case (partial failures surface via `totalFailed`).
    const data =
      payload?.__typename === 'ConfirmRecipeConsumptionPayload'
        ? payload
        : null;
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
    matchesLoading,
    confirmLoading,
    isSheetVisible,
    closeSheet,
    hasPantry: !!pantryId,
  };
}
