import { useMutation } from '@apollo/client/react';
import {
  GenerateShoppingListFromMealPlanDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { type GenerateShoppingListFromMealPlanInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export function useGenerateShoppingList(mealPlanId: string | null) {
  const [generateMutation, { loading }] = useMutation(
    GenerateShoppingListFromMealPlanDocument,
    {
      refetchQueries: [
        ...(mealPlanId
          ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
          : []),
        { query: GetShoppingListsLiteDocument },
      ],
      onError: error => {
        toastService.error(error.message || 'Failed to generate shopping list');
      },
    },
  );

  const generateShoppingList = async (
    input: Omit<GenerateShoppingListFromMealPlanInput, 'mealPlanId'>,
  ) => {
    if (!mealPlanId) return null;
    const result = await executeMutation(
      () =>
        generateMutation({
          variables: {
            input: {
              mealPlanId,
              ...input,
            },
          },
        }),
      'Generate shopping list error:',
    );
    if (!result) return null;
    const data = result.data?.generateShoppingListFromMealPlan;
    if (data?.success) {
      const homeName = data.shoppingList?.home?.name;
      const baseMsg = `Shopping list "${
        data.shoppingList?.name
      }" created with ${data.shoppingList?.totalItems ?? 0} items`;
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
  };

  return {
    generateShoppingList,
    loading,
  };
}
