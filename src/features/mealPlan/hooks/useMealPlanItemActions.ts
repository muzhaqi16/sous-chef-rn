/**
 * useMealPlanItemActions - Meal plan item create / update / toggle / delete
 * (local-first).
 *
 * Each operation writes its change to the cache PERMANENTLY before firing, so
 * it survives an offline / API-down queue (an `optimisticResponse` would roll
 * back the moment the queue completes the request with a null result):
 * - create: mints the permanent cuid PK and materializes the full item display
 *   shape (recipe resolved from cache); a replay that collides with the
 *   (mealPlanId, date, mealType, recipeId) unique key returns the existing row
 *   server-side, so the queued create is idempotent.
 * - update / toggle: merge over a snapshot; a rejection restores it.
 * - delete: removes the item up front; a rejection restores the snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  MealPlanItemActions_RecipeRefFragmentDoc,
  type MealPlanItemActions_RecipeRefFragment,
} from './useMealPlanItemActions.generated';
import { type MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';
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
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n/t';

const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
  'MealPlan',
  'mealPlanItems',
);
const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

/** Queued create/update results reported to callers as success. */
const QUEUED_CREATE_PAYLOAD: { __typename: 'CreateMealPlanItemPayload' } = {
  __typename: 'CreateMealPlanItemPayload',
};
const QUEUED_UPDATE_PAYLOAD: { __typename: 'UpdateMealPlanItemPayload' } = {
  __typename: 'UpdateMealPlanItemPayload',
};

/** The flat field union of the five item display fragments. */
type OptimisticMealPlanItem = {
  __typename: 'MealPlanItem';
  id: string;
  date: string;
  mealType: CreateMealPlanItemInput['mealType'];
  customMealName: string | null;
  servings: number | null;
  calories: number | null;
  usedPantryItems: MealPlanItemCard_ItemFragment['usedPantryItems'];
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  recipe: MealPlanItemActions_RecipeRefFragment | null;
};

/**
 * Materialize a complete optimistic MealPlanItem for a local-first create.
 * The recipe ref resolves from the cache's canonical Recipe entity (the user
 * just picked it, so it's cached); a miss degrades to a recipe-less card that
 * the post-replay refetch heals.
 */
function buildOptimisticMealPlanItem(
  cache: ApolloCache,
  id: string,
  input: CreateMealPlanItemInput,
): OptimisticMealPlanItem {
  const recipeCacheId = input.meal.recipeId
    ? cache.identify({ __typename: 'Recipe', id: input.meal.recipeId })
    : undefined;
  const recipe = recipeCacheId
    ? cache.readFragment<MealPlanItemActions_RecipeRefFragment>({
        id: recipeCacheId,
        fragment: MealPlanItemActions_RecipeRefFragmentDoc,
        fragmentName: 'MealPlanItemActions_recipeRef',
      })
    : null;

  return {
    __typename: 'MealPlanItem',
    id,
    date: input.date,
    mealType: input.mealType,
    customMealName: input.meal.customMealName ?? null,
    servings: input.servings ?? null,
    calories: input.calories ?? null,
    usedPantryItems: [],
    notes: input.notes ?? null,
    isCompleted: false,
    completedAt: null,
    recipe,
  };
}

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
  );

  const writeItem = (data: OptimisticMealPlanItem) =>
    client.cache.writeFragment({
      id: client.cache.identify(data),
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      data,
    });

  const readItemSnapshot = (id: string) =>
    client.cache.readFragment({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: { __typename: 'MealPlanItem', id },
    });

  const createItem = async (input: CreateMealPlanItemInput) => {
    // Local-first: mint the permanent cuid (the row's real PK) and write the
    // meal into the cache before firing, so adding works fully offline.
    const id = generateEntityId();
    const optimisticItem = buildOptimisticMealPlanItem(client.cache, id, input);
    executeCacheUpdate(() => {
      writeItem(optimisticItem);
      if (mealPlanId) {
        addToMealPlanItems(client.cache, mealPlanId, optimisticItem, {
          position: 'end',
        });
      }
    }, 'Add Meal (optimistic)');

    const result = await executeMutation(
      () =>
        createItemMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Create Meal Plan Item error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      executeCacheUpdate(() => {
        if (mealPlanId) {
          removeFromMealPlanItems(client.cache, mealPlanId, id, {
            evictItem: true,
          });
        }
      }, 'Revert rejected Meal Plan Item');
      const payload = result ? result.data?.createMealPlanItem : null;
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to add meal');
      return null;
    }
    if (outcome === 'queued') {
      // Offline / API down: the meal stays in cache and the create replays
      // keyed by the same id — report success to the caller.
      return QUEUED_CREATE_PAYLOAD;
    }
    const payload = result ? result.data?.createMealPlanItem : null;
    return payload?.__typename === 'CreateMealPlanItemPayload' ? payload : null;
  };

  const updateItem = async (
    id: string,
    input: Omit<UpdateMealPlanItemInput, 'id'>,
  ) => {
    // Permanent write BEFORE firing — survives an offline/API-down queue.
    const snapshot = readItemSnapshot(id) as OptimisticMealPlanItem | null;
    if (snapshot) {
      executeCacheUpdate(
        () =>
          writeItem({
            ...snapshot,
            ...(input.meal?.customMealName !== undefined && {
              customMealName: input.meal.customMealName,
            }),
            ...(input.servings !== undefined && { servings: input.servings }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.mealType != null && { mealType: input.mealType }),
            ...(input.date != null && { date: input.date }),
          }),
        'Update Meal (optimistic)',
      );
    }

    const result = await executeMutation(
      () =>
        updateItemMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Update Meal Plan Item error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      if (snapshot) {
        executeCacheUpdate(
          () => writeItem(snapshot),
          'Revert rejected Meal update',
        );
      }
      const payload = result ? result.data?.updateMealPlanItem : null;
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to update meal');
      return null;
    }
    if (outcome === 'queued') {
      return QUEUED_UPDATE_PAYLOAD;
    }
    const payload = result ? result.data?.updateMealPlanItem : null;
    return payload?.__typename === 'UpdateMealPlanItemPayload' ? payload : null;
  };

  const toggleCompleted = async (
    id: string,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ) => {
    // Materialize the full shape from cache — callers only pass an id, so we
    // read here to get isCompleted/recipe for branching and a complete entity
    // for the permanent write.
    const fullItem = readItemSnapshot(id) as OptimisticMealPlanItem | null;
    if (!fullItem) {
      toastService.error(t('toasts.mealUpdateFailed'));
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

    // Permanent write BEFORE firing — survives an offline/API-down queue.
    executeCacheUpdate(
      () =>
        writeItem({
          ...fullItem,
          isCompleted: markingComplete,
          completedAt,
          ...(options?.servings != null && { servings: options.servings }),
          ...(options?.notes != null && { notes: options.notes }),
        }),
      'Toggle Meal completed (optimistic)',
    );

    // No idempotencyKey needed on this ledger op. The server gates the pantry
    // deduction on the false → true completion transition, read live from the
    // pre-update row: a replayed completion (e.g. a lost-response offline-queue
    // replay) finds the item already isCompleted and skips the deduction, so it
    // never double-deducts. Confirmed server-side in sous-chef-api#178. (The
    // only unguarded case is two truly concurrent in-flight completions — not
    // the sequential queue-drain path this queues into.)
    const result = await executeMutation(
      () =>
        updateItemMutation({
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
          context: { localFirst: true },
        }),
      'Toggle Meal Plan Item error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      executeCacheUpdate(
        () => writeItem(fullItem),
        'Revert rejected Meal toggle',
      );
      optimisticDataPersistence.clear(
        'MealPlanItem',
        fullItem.id,
        'isCompleted',
      );
      const payload = result ? result.data?.updateMealPlanItem : null;
      const message = payload && 'message' in payload ? payload.message : null;
      toastService.error(message ?? 'Failed to update meal');
      return null;
    }

    if (outcome === 'created') {
      // Clear persisted optimistic state on server confirmation; a queued
      // toggle keeps it until the replay confirms.
      optimisticDataPersistence.clear(
        'MealPlanItem',
        fullItem.id,
        'isCompleted',
      );
    }

    if (markingComplete) {
      if (hasRecipe && deductFromPantry) {
        toastService.success(t('toasts.mealCompletedDeducted'));
      } else {
        toastService.success(t('toasts.mealCompleted'));
      }
    }

    if (outcome === 'queued') {
      return QUEUED_UPDATE_PAYLOAD;
    }
    const payload = result ? result.data?.updateMealPlanItem : null;
    return payload?.__typename === 'UpdateMealPlanItemPayload' ? payload : null;
  };

  const deleteItem = async (id: string) => {
    // Snapshot first so a server rejection can restore the meal.
    const snapshot = readItemSnapshot(id) as OptimisticMealPlanItem | null;

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // surfaces as NotFound, which the queue drops).
    executeCacheUpdate(() => {
      if (mealPlanId) {
        removeFromMealPlanItems(client.cache, mealPlanId, id, {
          evictItem: true,
        });
      }
    }, 'Delete Meal (optimistic)');

    // Claim the row for the duration of the mutation. A meal-plan event for
    // this same id — another member's earlier ITEM_ADDED still in flight, or
    // the server's own echo — would otherwise re-add it to `mealPlanItems`
    // after the optimistic removal above, and the meal would reappear.
    // `useMealPlanSubscriptions` checks this before applying anything.
    if (mealPlanId) {
      subscriptionService.registerPendingDelete(
        id,
        mealPlanId,
        'MealPlanItem',
        'MealPlan',
        'mealPlanItems',
      );
    }

    const result = await executeMutation(
      () =>
        deleteItemMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Delete Meal Plan Item error:',
    );

    // Released on every outcome — `executeMutation` reports rather than throws,
    // so this runs whether the delete committed, was refused, or was queued.
    subscriptionService.unregisterPendingDelete(id);

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      if (snapshot) {
        executeCacheUpdate(() => {
          writeItem(snapshot);
          if (mealPlanId) {
            addToMealPlanItems(client.cache, mealPlanId, snapshot, {
              position: 'end',
            });
          }
        }, 'Restore refused Meal delete');
      }
      return false;
    }
    return true;
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
