import {
  useCreateMealPlanMutation,
  useUpdateMealPlanMutation,
  useDeleteMealPlanMutation,
  GetMealPlansDocument,
  SortOrder,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#generated';

export function useMealPlanActions() {
  const [createMealPlanMutation, { loading: creating }] =
    useCreateMealPlanMutation({
      refetchQueries: [
        {
          query: GetMealPlansDocument,
          variables: { first: 20, orderBy: { startDate: SortOrder.Desc } },
        },
      ],
    });

  const [updateMealPlanMutation, { loading: updating }] =
    useUpdateMealPlanMutation();

  const [deleteMealPlanMutation, { loading: deleting }] =
    useDeleteMealPlanMutation({
      refetchQueries: [
        {
          query: GetMealPlansDocument,
          variables: { first: 20, orderBy: { startDate: SortOrder.Desc } },
        },
      ],
    });

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
