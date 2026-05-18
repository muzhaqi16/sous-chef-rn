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
        const plan = data?.createMealPlan?.mealPlan;
        if (plan) {
          addToMealPlans(cache, plan, { position: 'start' });
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
        if (!data?.deleteMealPlan?.success || !variables?.id) return;
        removeFromMealPlans(cache, variables.id, { evictItem: true });
      },
    },
  );

  const createMealPlan = async (input: CreateMealPlanInput) => {
    const result = await createMealPlanMutation({
      variables: { input },
    });
    return result.data?.createMealPlan ?? null;
  };

  const updateMealPlan = async (id: string, input: UpdateMealPlanInput) => {
    const result = await updateMealPlanMutation({
      variables: { id, input },
    });
    return result.data?.updateMealPlan ?? null;
  };

  const deleteMealPlan = async (id: string) => {
    const result = await deleteMealPlanMutation({
      variables: { id },
    });
    return result.data?.deleteMealPlan?.success ?? false;
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
