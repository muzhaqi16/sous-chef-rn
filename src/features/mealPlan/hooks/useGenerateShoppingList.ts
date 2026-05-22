import { useMutation } from '@apollo/client/react';
import { GenerateShoppingListFromMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { type GenerateShoppingListFromMealPlanInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  createAddToQueryConnectionUpdater,
  createAddToParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';

const addToShoppingLists = createAddToQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);
const addToMealPlanGeneratedLists = createAddToParentArrayUpdater(
  'MealPlan',
  'generatedShoppingLists',
);

export function useGenerateShoppingList(mealPlanId: string | null) {
  const [generateMutation, { loading }] = useMutation(
    GenerateShoppingListFromMealPlanDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.generateShoppingListFromMealPlan;
        if (payload?.__typename !== 'GenerateShoppingListFromMealPlanSuccess') {
          return;
        }
        const list = payload.shoppingList;
        addToShoppingLists(cache, list, { position: 'start' });
        const linkedMealPlanId = variables?.input?.mealPlanId;
        if (linkedMealPlanId) {
          addToMealPlanGeneratedLists(cache, linkedMealPlanId, list, {
            position: 'end',
          });
        }
      },
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
    if (data?.__typename === 'GenerateShoppingListFromMealPlanSuccess') {
      const homeName = data.shoppingList.home?.name;
      const baseMsg = `Shopping list "${data.shoppingList.name}" created with ${
        data.shoppingList.totalItems ?? 0
      } items`;
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
