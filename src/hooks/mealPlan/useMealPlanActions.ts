import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '../../graphql/operations/mealPlan/mealPlan.generated';
import {
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '../../graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

const addToMealPlans = createAddToQueryConnectionUpdater<{ id: string }>(
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
      update(cache, { data }) {
        const newPlan = data?.createMealPlan?.mealPlan;
        if (newPlan) addToMealPlans(cache, newPlan);
      },
    },
  );

  const [updateMealPlanMutation, { loading: updating }] = useMutation(
    UpdateMealPlanDocument,
  );

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    {
      update(cache, { data }, { variables }) {
        const id = data?.deleteMealPlan?.mealPlan?.id ?? variables?.id;
        if (id) removeFromMealPlans(cache, id, { evictItem: true });
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
