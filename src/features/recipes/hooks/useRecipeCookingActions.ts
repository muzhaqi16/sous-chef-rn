import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeIngredientMatching } from '#features/recipes/hooks/useRecipeIngredientMatching';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

interface UseRecipeCookingActionsOptions {
  recipeId: string | undefined;
}

interface MarkCookedInput {
  servings: number;
  deductFromPantry: boolean;
  useGranularDeduction: boolean;
  notes?: string;
}

export function useRecipeCookingActions({
  recipeId,
}: UseRecipeCookingActionsOptions) {
  const { t } = useTranslation();
  const [cookedModalVisible, setCookedModalVisible] = useState(false);
  const [markingAsCooked, setMarkingAsCooked] = useState(false);

  const ingredientMatching = useRecipeIngredientMatching(recipeId);

  const [markRecipeAsCookedMutation] = useMutation(MarkRecipeAsCookedDocument, {
    onError: err => {
      console.error('Mark recipe as cooked error:', err);
      toastService.error(err.message || t('recipes.markCookedFailed'));
    },
  });

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
          await markRecipeAsCookedMutation({
            variables: {
              input: {
                recipeId,
                servings: input.servings,
                deductFromPantry: input.deductFromPantry,
                notes: input.notes,
              },
            },
          });
          toastService.success(t('recipes.markedCookedDeducted'));
        }
      }, setMarkingAsCooked);
      return;
    }

    // Simple deduction path
    executeWithLoadingState(async () => {
      await markRecipeAsCookedMutation({
        variables: {
          input: {
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          },
        },
      });

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
      await markRecipeAsCookedMutation({
        variables: {
          input: {
            recipeId,
            servings: undefined,
            deductFromPantry: true,
          },
        },
      });
      toastService.success(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      );
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
