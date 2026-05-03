import { useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import {
  MatchRecipeIngredientsToPantryDocument,
  ConfirmRecipeConsumptionDocument,
  type MatchRecipeIngredientsToPantryQuery,
} from '#features/recipes/graphql/recipe.generated';
import { type ConfirmedIngredientConsumptionInput } from '#/graphql/generated/schemaTypes';
import { useSelectedPantryId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';

type IngredientMatch =
  MatchRecipeIngredientsToPantryQuery['matchRecipeIngredientsToPantry'][number];

export interface EditableMatch {
  match: IngredientMatch;
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
  const pantryId = useSelectedPantryId();
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
        toastService.error(error.message || 'Failed to confirm consumption');
      },
    },
  );

  const loadMatches = async (servings: number) => {
    if (!recipeId || !pantryId) {
      toastService.error('Recipe or pantry not available');
      return false;
    }

    const result = await executeMutation(
      () =>
        loadMatchesQuery({
          variables: { recipeId, pantryId, servings },
        }),
      'Load recipe matches error:',
    );
    if (!result) return false;

    const matches = result.data?.matchRecipeIngredientsToPantry;
    if (!matches || matches.length === 0) {
      toastService.info('No ingredients to match');
      return false;
    }

    const editable: EditableMatch[] = matches.map(match => ({
      match,
      adjustedQuantity: match.suggestedQuantity,
      adjustedUnitId:
        match.suggestedUnit?.id ?? match.ingredient?.unit?.id ?? null,
      isIncluded: !match.ingredient.isOptional && !!match.matchedPantryItem,
    }));

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
        recipeIngredientId: em.match.ingredient.id,
        pantryItemId: em.match.matchedPantryItem!.id,
        quantity: em.adjustedQuantity,
        unitId:
          em.adjustedUnitId ||
          em.match.suggestedUnit?.id ||
          em.match.matchedPantryItem!.unit?.id ||
          '',
      }));

    if (consumptions.length === 0) {
      toastService.info('No ingredients selected for deduction');
      return;
    }

    const result = await executeMutation(
      () =>
        confirmMutation({
          variables: { input: { recipeId, pantryId, consumptions } },
        }),
      'Confirm recipe consumption error:',
    );
    if (!result) return;

    const data = result.data?.confirmRecipeConsumption;
    if (data?.success) {
      const failedText =
        data.totalFailed > 0 ? ` (${data.totalFailed} failed)` : '';
      toastService.success(
        `Deducted ${data.totalConsumed} ingredient${
          data.totalConsumed !== 1 ? 's' : ''
        } from pantry${failedText}`,
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
