import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { MealPlanItemActions_OptimisticFullItemFragmentDoc } from './useMealPlanItemActions.generated';
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

const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
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
        const result = data?.createMealPlanItem;
        if (result?.__typename !== 'CreateMealPlanItemPayload' || !mealPlanId) {
          return;
        }
        addToMealPlanItems(cache, mealPlanId, result.mealPlanItem, {
          position: 'end',
        });
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
        const result = data?.deleteMealPlanItem;
        if (result?.__typename !== 'DeleteMealPlanItemPayload' || !mealPlanId) {
          return;
        }
        removeFromMealPlanItems(cache, mealPlanId, result.mealPlanItem.id, {
          evictItem: true,
        });
      },
    },
  );

  const createItem = async (input: CreateMealPlanItemInput) => {
    const result = await createItemMutation({
      variables: { input },
    });
    const payload = result.data?.createMealPlanItem;
    if (payload?.__typename !== 'CreateMealPlanItemPayload') {
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to add meal');
      return null;
    }
    return payload;
  };

  const updateItem = async (
    id: string,
    input: Omit<UpdateMealPlanItemInput, 'id'>,
  ) => {
    const result = await updateItemMutation({
      variables: { input: { ...input, id } },
    });
    const payload = result.data?.updateMealPlanItem;
    if (payload?.__typename !== 'UpdateMealPlanItemPayload') {
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to update meal');
      return null;
    }
    return payload;
  };

  const toggleCompleted = async (
    id: string,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ) => {
    // Materialize the full optimistic shape from cache — callers only pass an
    // id, so we read here to get isCompleted/recipe for branching and a
    // complete payload to spread into the optimistic response.
    const fullItem = client.cache.readFragment({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: { __typename: 'MealPlanItem', id },
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
        input: {
          id: fullItem.id,
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
          __typename: 'UpdateMealPlanItemPayload',
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
    if (payload?.__typename !== 'UpdateMealPlanItemPayload') {
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to update meal');
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
      variables: { input: { id } },
    });
    return (
      result.data?.deleteMealPlanItem?.__typename ===
      'DeleteMealPlanItemPayload'
    );
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
