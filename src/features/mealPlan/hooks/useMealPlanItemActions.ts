import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  type MealPlanItemActions_OptimisticFullItemFragment,
} from './useMealPlanItemActions.generated';
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
  const client = useApolloClient();
  const [createItemMutation, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    {
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

  // No update/refetch needed — the mutation returns the full mealPlanItem
  // with id, so Apollo auto-normalizes the cache entry.
  const [updateItemMutation, { loading: updating }] = useMutation(
    UpdateMealPlanItemDocument,
  );

  const [deleteItemMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanItemDocument,
    {
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
    // Item arrives masked (only `__typename` + `$fragmentRefs`). Materialize
    // through the compound optimistic fragment so we have id/isCompleted/recipe
    // for branching and a complete unmasked payload to spread into the
    // optimistic response. `cache.readFragment<T>` returns `Unmasked<T> | null`,
    // so no explicit `Unmasked<>` wrap is needed here.
    const fullItem = client.cache.readFragment({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: item,
    });
    if (!fullItem) {
      toastService.error('Failed to update meal');
      return null;
    }

    const markingComplete = !fullItem.isCompleted;
    const hasRecipe = !!fullItem.recipe;
    const deductFromPantry = options?.deductFromPantry;
    const completedAt = markingComplete ? new Date().toISOString() : null;

    // Persist optimistic completion state to survive cache-and-network refetches while offline
    optimisticDataPersistence.save(
      'MealPlanItem',
      fullItem.id,
      'isCompleted',
      markingComplete,
    );

    const result = await updateItemMutation({
      variables: {
        id: fullItem.id,
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
            ...fullItem,
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
    optimisticDataPersistence.clear('MealPlanItem', fullItem.id, 'isCompleted');

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
