import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { handleMutationError } from '#/utils/errorHandlers';

const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

export function useMealPlanActions() {
  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    {
      update: (cache, { data }) => {
        const result = data?.createMealPlan;
        if (result?.__typename === 'CreateMealPlanPayload') {
          addToMealPlans(cache, result.mealPlan, { position: 'start' });
        }
      },
    },
  );

  const [updateMealPlanMutation, { loading: updating }] = useMutation(
    UpdateMealPlanDocument,
  );

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    {
      update: (cache, { data }, { variables }) => {
        const result = data?.deleteMealPlan;
        if (
          result?.__typename !== 'DeleteMealPlanPayload' ||
          !variables?.input?.id
        ) {
          return;
        }
        removeFromMealPlans(cache, variables.input.id, { evictItem: true });
      },
      onError: error => {
        handleMutationError(error, { operation: 'Delete Meal Plan' });
      },
    },
  );

  const createMealPlan = async (input: CreateMealPlanInput) => {
    const result = await createMealPlanMutation({
      variables: { input },
    });
    return result.data?.createMealPlan ?? null;
  };

  const updateMealPlan = async (
    id: string,
    input: Omit<UpdateMealPlanInput, 'id'>,
  ) => {
    const result = await updateMealPlanMutation({
      variables: { input: { ...input, id } },
    });
    return result.data?.updateMealPlan ?? null;
  };

  const deleteMealPlan = async (id: string) => {
    const result = await deleteMealPlanMutation({
      variables: { input: { id } },
    });
    return result.data?.deleteMealPlan?.__typename === 'DeleteMealPlanPayload';
  };

  return {
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    loading: creating || updating || deleting,
    creating,
    updating,
    deleting,
  };
}
