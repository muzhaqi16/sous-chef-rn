/**
 * Item create, toggle and delete write the cache PERMANENTLY before firing: an
 * `optimisticResponse` rolls back on the queue's null result. A replayed create
 * meets the (mealPlanId, date, mealType, recipeId) unique key.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  MealPlanItemActions_PlanBoundsFragmentDoc,
} from './useMealPlanItemActions.generated';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  MEAL_PLAN_ITEMS_FIELD,
  addToMealPlanItems,
  adoptServerMealPlanItem,
  removeFromMealPlanItems,
  writeMealPlanItem,
  writeLocalMealPlanItem,
} from '#features/mealPlan/cache/mealPlanItem';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { chainVersionedWrite } from '#/apollo/utils/entityWriteChain';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';
import { keepDayInsidePlan } from '#/utils/dateUtils';

export function useMealPlanItemActions(mealPlanId: string | null) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [createItemMutation, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    {
      context: { localFirst: true },
      update(cache, { data }, { variables }) {
        const payload = appliedPayload(data);
        if (!payload || !variables) return;
        adoptServerMealPlanItem(
          cache,
          variables.input.mealPlanId,
          payload.mealPlanItem.id,
          variables.input.id,
        );
      },
    },
  );

  // No update/refetch needed — the mutation returns the full mealPlanItem
  // with id, so Apollo auto-normalizes the cache entry.
  const [updateItemMutation] = useMutation(UpdateMealPlanItemDocument, {
    context: { localFirst: true },
  });

  const [deleteItemMutation] = useMutation(DeleteMealPlanItemDocument, {
    context: { localFirst: true },
  });

  const readItemSnapshot = (id: string) =>
    client.cache.readFragment({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: { __typename: 'MealPlanItem', id },
    });

  /** `true` once the meal landed or is queued; `false` when it reverted. */
  const createItem = async (
    input: CreateMealPlanItemInput,
  ): Promise<boolean> => {
    const bounds = client.cache.readFragment({
      fragment: MealPlanItemActions_PlanBoundsFragmentDoc,
      fragmentName: 'MealPlanItemActions_planBounds',
      from: { __typename: 'MealPlan', id: input.mealPlanId },
    });
    // Local-first: mint the permanent cuid (the row's real PK) and write the
    // meal into the cache before firing, so adding works fully offline.
    const itemInput = {
      ...input,
      id: generateEntityId(),
      date: keepDayInsidePlan(input.date, bounds ?? undefined),
    };
    const revertCreate = writeLocalMealPlanItem(client.cache, itemInput);

    const settled = await settleMutation(
      () =>
        createItemMutation({
          variables: { input: itemInput },
        }),
      {
        document: CreateMealPlanItemDocument,
        fallback: t('mealTemplateBuilder.failedToAddItem'),
        onFailed: revertCreate,
        present: 'toast',
      },
    );
    // Queued, the meal stays in cache and the create replays under its id.
    return !settled.failure;
  };

  const toggleCompleted = async (
    id: string,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ): Promise<boolean> => {
    // Materialize the full shape from cache — callers only pass an id, so we
    // read here to get isCompleted/recipe for branching and a complete entity
    // for the permanent write.
    const fullItem = readItemSnapshot(id);
    if (!fullItem) {
      toastService.error(t('toasts.mealUpdateFailed'));
      return false;
    }

    const markingComplete = !fullItem.isCompleted;
    const hasRecipe = !!fullItem.recipe;
    const deductFromPantry = options?.deductFromPantry;
    const completedAt = markingComplete ? new Date().toISOString() : null;

    // Persisted, so the completion survives a cache-and-network refetch offline.
    const clearPersisted = optimisticDataPersistence.track(
      'MealPlanItem',
      fullItem.id,
      'isCompleted',
      markingComplete,
    );

    // Permanent write BEFORE firing — survives an offline/API-down queue.
    // Built before the try: conditional spreads inside a try body make the
    // React Compiler bail out of this hook.
    const completedItem = {
      ...fullItem,
      isCompleted: markingComplete,
      completedAt,
      ...(options?.servings != null && { servings: options.servings }),
      ...(options?.notes != null && { notes: options.notes }),
    };
    try {
      writeMealPlanItem(client.cache, completedItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Toggle Meal completed (optimistic)',
      });
    }

    // No idempotencyKey: the write states the `version` it read and every
    // write steps it, so of two completions sent at one version one lands and
    // the other is a VERSION_CONFLICT — the pantry is deducted once.
    const completionInput = {
      id: fullItem.id,
      isCompleted: markingComplete,
      completedAt,
      ...(markingComplete && deductFromPantry != null && { deductFromPantry }),
      ...(markingComplete &&
        options?.servings != null && { servings: options.servings }),
      ...(markingComplete &&
        options?.notes != null && { notes: options.notes }),
    };
    const revertToggle = () => {
      try {
        writeMealPlanItem(client.cache, fullItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal toggle',
        });
      }
      clearPersisted();
    };

    const refetchPlan = () => {
      void client.refetchQueries({ include: ['GetMealPlan'] });
    };
    const settled = await settleMutation(
      () =>
        chainVersionedWrite(
          client.cache,
          { __typename: 'MealPlanItem', id: fullItem.id },
          version =>
            updateItemMutation({
              variables: { input: { ...completionInput, version } },
            }),
        ),
      {
        document: UpdateMealPlanItemDocument,
        fallback: t('toasts.mealUpdateFailed'),
        onFailed: revertToggle,
        // A stale version means another member changed the meal: show theirs.
        onVersionConflict: refetchPlan,
        present: 'toast',
      },
    );

    if (settled.failure) return false;

    // A queued toggle keeps its persisted state until the replay confirms.
    if (settled.status === 'applied') clearPersisted();

    if (markingComplete) {
      toastService.success(
        t(
          hasRecipe && deductFromPantry
            ? 'toasts.mealCompletedDeducted'
            : 'toasts.mealCompleted',
        ),
      );
    }

    return true;
  };

  const deleteItem = async (id: string) => {
    // Snapshot first so a server rejection can restore the meal.
    const snapshot = readItemSnapshot(id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // answers `converged`, which settles as applied).
    if (mealPlanId) {
      try {
        removeFromMealPlanItems(client.cache, mealPlanId, id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Delete Meal (optimistic)',
        });
      }
      // Claimed for the mutation's duration: a meal-plan event for this id
      // (another member's earlier ITEM_ADDED, or the server's echo) would
      // re-add it. `useMealPlanSubscriptions` checks this before applying.
      subscriptionService.registerPendingDelete(
        id,
        mealPlanId,
        'MealPlanItem',
        'MealPlan',
        MEAL_PLAN_ITEMS_FIELD,
      );
    }

    const restoreItem = () => {
      if (!snapshot) return;
      try {
        writeMealPlanItem(client.cache, snapshot);
        if (mealPlanId) {
          addToMealPlanItems(client.cache, mealPlanId, snapshot, {
            position: 'end',
          });
        }
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Restore refused Meal delete',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        deleteItemMutation({
          variables: { input: { id } },
        }),
      {
        document: DeleteMealPlanItemDocument,
        fallback: t('mealTemplateBuilder.failedToRemoveItem'),
        removal: true,
        onFailed: restoreItem,
        present: 'toast',
      },
    );

    // Released on every outcome — settling never throws, so this runs whether
    // the delete committed, was refused, or was queued.
    subscriptionService.unregisterPendingDelete(id);
    return !settled.failure;
  };

  return {
    createItem,
    toggleCompleted,
    deleteItem,
    creating,
  };
}
