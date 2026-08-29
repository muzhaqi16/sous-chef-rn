import { useMutation } from '@apollo/client/react';
import { GenerateShoppingListFromMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { type GenerateShoppingListFromMealPlanInput } from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import {
  createAddToQueryConnectionUpdater,
  createAddToParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';
import { errorService } from '#/services/errorService';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';

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
        if (payload?.__typename !== 'GenerateShoppingListFromMealPlanPayload') {
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
        handleMutationError(error, { operation: 'Generate Shopping List' });
      },
    },
  );

  const isApiUnavailable = useIsApiUnavailable();

  const generateShoppingList = async (
    input: Omit<GenerateShoppingListFromMealPlanInput, 'mealPlanId'>,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    if (!mealPlanId) return null;
    let result;
    try {
      result = await generateMutation({
        variables: {
          input: {
            mealPlanId,
            ...input,
          },
        },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Generate shopping list error:',
      });
    }
    if (!result) return null;
    const data = result.data?.generateShoppingListFromMealPlan;
    if (data?.__typename === 'GenerateShoppingListFromMealPlanPayload') {
      const { shoppingList } = data;
      const itemCount = shoppingList.totalItems ?? 0;
      if (itemCount === 0) {
        // Plan generated but nothing to buy — pantry already covers it, or the
        // recipes have no linked catalog items. Surface it instead of a
        // misleading "created with 0 items" success.
        toastService.info(
          getI18n().t('generateShoppingList.readyNothingToAdd', {
            name: shoppingList.name,
          }),
        );
      } else {
        const homeName = shoppingList.home?.name;
        const shared = homeName
          ? getI18n().t('generateShoppingList.sharedSuffix', { homeName })
          : '';
        toastService.success(
          getI18n().t('generateShoppingList.createdSuccess', {
            name: shoppingList.name,
            count: itemCount,
            shared,
          }),
        );
      }
      Telemetry.trackEvent('shopping_list_generated_from_meal_plan', {
        meal_plan_id: mealPlanId,
        check_pantry: input.checkPantry ?? true,
        added_to_existing: !!input.shoppingListId,
      });
    } else if (data && 'message' in data) {
      // Result-union error member (ValidationError for an empty plan,
      // Forbidden/NotFound/Conflict). `message` comes from the `Error`
      // interface selected in the mutation document.
      // The member's `message` is the server's English by construction; the
      // field it names (or its code) is what the app has copy for.
      toastService.error(
        localizedRefusalMessage(data, t('generateShoppingList.generateFailed')),
      );
    }
    return data ?? null;
  };

  return {
    generateShoppingList,
    loading,
    isApiUnavailable,
  };
}
