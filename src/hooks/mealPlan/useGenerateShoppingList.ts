import { useCallback } from 'react';
import {
  useGenerateShoppingListFromMealPlanMutation,
  GetMealPlanDocument,
  GetShoppingListsLiteDocument,
  type GenerateShoppingListFromMealPlanInput,
} from '#generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';

export function useGenerateShoppingList(mealPlanId: string | null) {
  const [generateMutation, { loading }] =
    useGenerateShoppingListFromMealPlanMutation({
      refetchQueries: [
        ...(mealPlanId
          ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
          : []),
        { query: GetShoppingListsLiteDocument },
      ],
      onError: error => {
        toastService.error(
          error.message || 'Failed to generate shopping list',
        );
      },
    });

  const generateShoppingList = useCallback(
    async (input: Omit<GenerateShoppingListFromMealPlanInput, 'mealPlanId'>) => {
      if (!mealPlanId) return null;
      try {
        const result = await generateMutation({
          variables: {
            input: {
              mealPlanId,
              ...input,
            },
          },
        });
        const data = result.data?.generateShoppingListFromMealPlan;
        if (data?.success) {
          const homeName = data.shoppingList?.home?.name;
          const baseMsg = `Shopping list "${data.shoppingList?.name}" created with ${data.shoppingList?.totalItems ?? 0} items`;
          toastService.success(
            homeName ? `${baseMsg} (shared with ${homeName})` : baseMsg,
          );
          Telemetry.trackEvent('shopping_list_generated_from_meal_plan', {
            meal_plan_id: mealPlanId,
            check_pantry: input.checkPantry ?? true,
            added_to_existing: !!input.shoppingListId,
          });
        }
        return data ?? null;
      } catch {
        return null;
      }
    },
    [mealPlanId, generateMutation],
  );

  return {
    generateShoppingList,
    loading,
  };
}
