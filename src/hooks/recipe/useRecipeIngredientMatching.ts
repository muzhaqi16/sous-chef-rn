import { useState, useCallback, useMemo } from 'react';
import {
  useMatchRecipeIngredientsToPantryLazyQuery,
  useConfirmRecipeConsumptionMutation,
  type MatchRecipeIngredientsToPantryQuery,
  type ConfirmedIngredientConsumptionInput,
} from '#generated';
import { useAppStore, selectSelectedPantryId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';

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

export function getAvailabilityStatus(match: IngredientMatch): AvailabilityStatus {
  if (match.isAvailable && match.matchConfidence >= 0.8) return 'available';
  if (match.matchedPantryItem && !match.isAvailable && match.availableQuantity > 0)
    return 'partial';
  return 'missing';
}

export function useRecipeIngredientMatching(recipeId: string | undefined) {
  const pantryId = useAppStore(selectSelectedPantryId);
  const [editableMatches, setEditableMatches] = useState<EditableMatch[]>([]);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const [loadMatchesQuery, { loading: matchesLoading }] =
    useMatchRecipeIngredientsToPantryLazyQuery({
      fetchPolicy: 'network-only',
    });

  const [confirmMutation, { loading: confirmLoading }] =
    useConfirmRecipeConsumptionMutation({
      onError: error => {
        toastService.error(error.message || 'Failed to confirm consumption');
      },
    });

  const loadMatches = useCallback(
    async (servings: number) => {
      if (!recipeId || !pantryId) {
        toastService.error('Recipe or pantry not available');
        return false;
      }

      try {
        const result = await loadMatchesQuery({
          variables: { recipeId, pantryId, servings },
        });

        const matches = result.data?.matchRecipeIngredientsToPantry;
        if (!matches || matches.length === 0) {
          toastService.info('No ingredients to match');
          return false;
        }

        const editable: EditableMatch[] = matches.map(match => ({
          match,
          adjustedQuantity: match.suggestedQuantity,
          adjustedUnitId: match.suggestedUnit?.id ?? match.ingredient?.unit?.id ?? null,
          isIncluded:
            !match.ingredient.isOptional &&
            !!match.matchedPantryItem,
        }));

        setEditableMatches(editable);
        setIsSheetVisible(true);
        return true;
      } catch {
        return false;
      }
    },
    [recipeId, pantryId, loadMatchesQuery],
  );

  const updateMatch = useCallback(
    (index: number, updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'adjustedUnitId' | 'isIncluded'>>) => {
      setEditableMatches(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    [],
  );

  const matchSummary = useMemo((): MatchSummary => {
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

    return {
      total: editableMatches.length,
      available,
      partial,
      missing,
      included,
    };
  }, [editableMatches]);

  const confirmConsumption = useCallback(async () => {
    if (!recipeId || !pantryId) return;

    const consumptions: ConfirmedIngredientConsumptionInput[] = editableMatches
      .filter(em => em.isIncluded && em.match.matchedPantryItem)
      .map(em => ({
        recipeIngredientId: em.match.ingredient.id,
        pantryItemId: em.match.matchedPantryItem!.id,
        quantity: em.adjustedQuantity,
        unitId: em.adjustedUnitId || em.match.suggestedUnit?.id || em.match.matchedPantryItem!.unit?.id || '',
      }));

    if (consumptions.length === 0) {
      toastService.info('No ingredients selected for deduction');
      return;
    }

    try {
      const result = await confirmMutation({
        variables: { input: { recipeId, pantryId, consumptions } },
      });

      const data = result.data?.confirmRecipeConsumption;
      if (data?.success) {
        const failedText = data.totalFailed > 0
          ? ` (${data.totalFailed} failed)`
          : '';
        toastService.success(
          `Deducted ${data.totalConsumed} ingredient${data.totalConsumed !== 1 ? 's' : ''} from pantry${failedText}`,
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
    } catch {
      // Error handled by mutation onError
    }
  }, [recipeId, pantryId, editableMatches, confirmMutation]);

  const closeSheet = useCallback(() => {
    setIsSheetVisible(false);
  }, []);

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
