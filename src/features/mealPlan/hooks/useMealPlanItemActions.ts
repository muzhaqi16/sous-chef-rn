import { useMutation } from '@apollo/client/react';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { type MealPlanItemActions_OptimisticFullItemFragment } from './useMealPlanItemActions.generated';
import {
  type CreateMealPlanItemInput,
  type UpdateMealPlanItemInput,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';

const addToMealPlanItems = createAddToParentArrayUpdater<any>(
  'MealPlan',
  'mealPlanItems',
);
const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

export function useMealPlanItemActions(mealPlanId: string | null) {
  const refetchConfig = mealPlanId
    ? [{ query: GetMealPlanDocument, variables: { id: mealPlanId } }]
    : [];

  const [createItemMutation, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    {
      refetchQueries: refetchConfig,
      update(cache, { data }) {
        if (!data?.createMealPlanItem?.mealPlanItem || !mealPlanId) return;
        addToMealPlanItems(
          cache,
          mealPlanId,
          data.createMealPlanItem.mealPlanItem,
          { position: 'end' },
        );
      },
    },
  );

  const [updateItemMutation, { loading: updating }] = useMutation(
    UpdateMealPlanItemDocument,
    {
      refetchQueries: refetchConfig,
    },
  );

  const [deleteItemMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanItemDocument,
    {
      refetchQueries: refetchConfig,
      update(cache, { data }) {
        if (!data?.deleteMealPlanItem?.mealPlanItem?.id || !mealPlanId) return;
        removeFromMealPlanItems(
          cache,
          mealPlanId,
          data.deleteMealPlanItem.mealPlanItem.id,
          { evictItem: true },
        );
      },
    },
  );

  const createItem = async (input: CreateMealPlanItemInput) => {
    const result = await createItemMutation({
      variables: { input },
    });
    const payload = result.data?.createMealPlanItem;
    if (!payload?.success) {
      toastService.error(payload?.message ?? 'Failed to add meal');
      return null;
    }
    return payload;
  };

  const updateItem = async (id: string, input: UpdateMealPlanItemInput) => {
    const result = await updateItemMutation({
      variables: { id, input },
    });
    const payload = result.data?.updateMealPlanItem;
    if (!payload?.success) {
      toastService.error(payload?.message ?? 'Failed to update meal');
      return null;
    }
    return payload;
  };

  const toggleCompleted = async (
    item: MealPlanItemActions_OptimisticFullItemFragment,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ) => {
    const markingComplete = !item.isCompleted;
    const hasRecipe = !!item.recipe;
    const deductFromPantry = options?.deductFromPantry;
    const completedAt = markingComplete ? new Date().toISOString() : null;

    // Persist optimistic completion state to survive cache-and-network refetches while offline
    optimisticDataPersistence.save(
      'MealPlanItem',
      item.id,
      'isCompleted',
      markingComplete,
    );

    const result = await updateItemMutation({
      variables: {
        id: item.id,
        input: {
          isCompleted: markingComplete,
          completedAt,
          ...(markingComplete &&
            deductFromPantry != null && { deductFromPantry }),
          ...(markingComplete &&
            options?.servings != null && { servings: options.servings }),
          ...(markingComplete &&
            options?.notes != null && { notes: options.notes }),
        },
      },
      optimisticResponse: {
        __typename: 'Mutation',
        updateMealPlanItem: {
          __typename: 'MealPlanItemPayload',
          success: true,
          message: 'Updated',
          code: 'SUCCESS',
          mealPlanItem: {
            ...item,
            isCompleted: markingComplete,
            completedAt,
            ...(options?.servings != null && { servings: options.servings }),
            ...(options?.notes != null && { notes: options.notes }),
          },
        },
      },
    });

    const payload = result.data?.updateMealPlanItem;
    if (!payload?.success) {
      toastService.error(payload?.message ?? 'Failed to update meal');
      return null;
    }

    // Clear persisted optimistic state on server confirmation
    optimisticDataPersistence.clear('MealPlanItem', item.id, 'isCompleted');

    if (markingComplete) {
      if (hasRecipe && deductFromPantry) {
        toastService.success('Meal completed! Pantry items deducted.');
      } else {
        toastService.success('Meal completed!');
      }
    }

    return payload;
  };

  const deleteItem = async (id: string) => {
    const result = await deleteItemMutation({
      variables: { id },
    });
    return result.data?.deleteMealPlanItem?.success ?? false;
  };

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
