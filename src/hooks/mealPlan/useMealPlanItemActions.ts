import { useCallback } from 'react';
import {
  useCreateMealPlanItemMutation,
  useUpdateMealPlanItemMutation,
  useDeleteMealPlanItemMutation,
  type CreateMealPlanItemInput,
  type UpdateMealPlanItemInput,
  GetMealPlanDocument,
} from '#generated';
import { toastService } from '#/services/toastService';

export function useMealPlanItemActions(mealPlanId: string | null) {
  const [createItemMutation, { loading: creating }] =
    useCreateMealPlanItemMutation({
      refetchQueries: mealPlanId
        ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
        : [],
    });

  const [updateItemMutation, { loading: updating }] =
    useUpdateMealPlanItemMutation();

  const [deleteItemMutation, { loading: deleting }] =
    useDeleteMealPlanItemMutation({
      refetchQueries: mealPlanId
        ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
        : [],
    });

  const createItem = useCallback(
    async (input: CreateMealPlanItemInput) => {
      const result = await createItemMutation({
        variables: { input },
      });
      return result.data?.createMealPlanItem ?? null;
    },
    [createItemMutation],
  );

  const updateItem = useCallback(
    async (id: string, input: UpdateMealPlanItemInput) => {
      const result = await updateItemMutation({
        variables: { id, input },
      });
      return result.data?.updateMealPlanItem ?? null;
    },
    [updateItemMutation],
  );

  const toggleCompleted = useCallback(
    async (id: string, isCompleted: boolean, hasRecipe?: boolean) => {
      const markingComplete = !isCompleted;
      const result = await updateItemMutation({
        variables: {
          id,
          input: {
            isCompleted: markingComplete,
            completedAt: markingComplete ? new Date().toISOString() : null,
          },
        },
        refetchQueries: mealPlanId
          ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
          : [],
      });

      if (result.data?.updateMealPlanItem?.success && markingComplete) {
        if (hasRecipe) {
          toastService.success('Meal completed! Pantry items deducted.');
        } else {
          toastService.success('Meal completed!');
        }
      }

      return result.data?.updateMealPlanItem ?? null;
    },
    [updateItemMutation, mealPlanId],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const result = await deleteItemMutation({
        variables: { id },
      });
      return result.data?.deleteMealPlanItem?.success ?? false;
    },
    [deleteItemMutation],
  );

  return {
    createItem,
    updateItem,
    toggleCompleted,
    deleteItem,
    loading: creating || updating || deleting,
    creating,
    updating,
    deleting,
  };
}
