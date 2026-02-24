import { useCallback } from 'react';
import {
  useCreateMealPlanMutation,
  useUpdateMealPlanMutation,
  useDeleteMealPlanMutation,
  GetMealPlansDocument,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#generated';

export function useMealPlanActions() {
  const [createMealPlanMutation, { loading: creating }] =
    useCreateMealPlanMutation({
      refetchQueries: [{ query: GetMealPlansDocument }],
    });

  const [updateMealPlanMutation, { loading: updating }] =
    useUpdateMealPlanMutation();

  const [deleteMealPlanMutation, { loading: deleting }] =
    useDeleteMealPlanMutation({
      refetchQueries: [{ query: GetMealPlansDocument }],
    });

  const createMealPlan = useCallback(
    async (input: CreateMealPlanInput) => {
      const result = await createMealPlanMutation({
        variables: { input },
      });
      return result.data?.createMealPlan ?? null;
    },
    [createMealPlanMutation],
  );

  const updateMealPlan = useCallback(
    async (id: string, input: UpdateMealPlanInput) => {
      const result = await updateMealPlanMutation({
        variables: { id, input },
      });
      return result.data?.updateMealPlan ?? null;
    },
    [updateMealPlanMutation],
  );

  const deleteMealPlan = useCallback(
    async (id: string) => {
      const result = await deleteMealPlanMutation({
        variables: { id },
      });
      return result.data?.deleteMealPlan?.success ?? false;
    },
    [deleteMealPlanMutation],
  );

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
