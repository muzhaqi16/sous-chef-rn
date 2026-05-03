import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
  GetMealPlansDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  SortOrder,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#/graphql/generated/schemaTypes';

export function useMealPlanActions() {
  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    {
      refetchQueries: [
        {
          query: GetMealPlansDocument,
          variables: { first: 20, orderBy: { startDate: SortOrder.Desc } },
        },
      ],
    },
  );

  const [updateMealPlanMutation, { loading: updating }] =
    useMutation(UpdateMealPlanDocument);

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    {
      refetchQueries: [
        {
          query: GetMealPlansDocument,
          variables: { first: 20, orderBy: { startDate: SortOrder.Desc } },
        },
      ],
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
