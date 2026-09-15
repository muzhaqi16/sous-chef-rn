/**
 * Meal plan item create / toggle-completed / delete, local-first: each writes the
 * cache PERMANENTLY before firing, since an `optimisticResponse` rolls back when
 * the queue completes with a null result. A replayed create collides with the
 * (mealPlanId, date, mealType, recipeId) unique key, so it is idempotent.
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
import type { MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';

const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
  'MealPlan',
  'mealPlanItems',
);
const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

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
  const { t } = useTranslation();
  const [createItemMutation, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    {
      update(cache, { data }) {
        const payload = appliedPayload(data);
        if (!payload || !mealPlanId) return;
        addToMealPlanItems(cache, mealPlanId, payload.mealPlanItem, {
          position: 'end',
        });
      },
    },
  );

  // No update/refetch needed — the mutation returns the full mealPlanItem
  // with id, so Apollo auto-normalizes the cache entry.
  const [updateItemMutation] = useMutation(UpdateMealPlanItemDocument);

  const [deleteItemMutation] = useMutation(DeleteMealPlanItemDocument);

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

  /** `true` once the meal landed or is queued; `false` when it reverted. */
  const createItem = async (
    input: CreateMealPlanItemInput,
  ): Promise<boolean> => {
    // Local-first: mint the permanent cuid (the row's real PK) and write the
    // meal into the cache before firing, so adding works fully offline.
    const id = generateEntityId();
    const optimisticItem = buildOptimisticMealPlanItem(client.cache, id, input);
    try {
      writeItem(optimisticItem);
      if (mealPlanId) {
        addToMealPlanItems(client.cache, mealPlanId, optimisticItem, {
          position: 'end',
        });
      }
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Meal (optimistic)',
      });
    }

    const revertCreate = () => {
      try {
        if (mealPlanId) {
          removeFromMealPlanItems(client.cache, mealPlanId, id, {
            evictItem: true,
          });
        }
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal Plan Item',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        createItemMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      {
        document: CreateMealPlanItemDocument,
        fallback: t('mealTemplateBuilder.failedToAddItem'),
        onFailed: revertCreate,
        // Meal actions on the plan report failures as toasts.
        present: 'none',
      },
    );

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return false;
    }
    // Offline / API down: the meal stays in cache and the create replays keyed
    // by the same id.
    return true;
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

    // Persist optimistic completion state to survive cache-and-network refetches while offline
    optimisticDataPersistence.save(
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
      writeItem(completedItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Toggle Meal completed (optimistic)',
      });
    }

    // No idempotencyKey: the server gates the pantry deduction on the
    // false → true transition read from the pre-update row, so a replayed
    // completion finds `isCompleted` already true and skips it (sous-chef-api
    // #178). Only two truly concurrent completions are unguarded — not this
    // sequential queue-drain path.
    const updateItemMutationOptions = {
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
    };
    const revertToggle = () => {
      try {
        writeItem(fullItem);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal toggle',
        });
      }
      optimisticDataPersistence.clear(
        'MealPlanItem',
        fullItem.id,
        'isCompleted',
      );
    };

    const settled = await settleMutation(
      () => updateItemMutation(updateItemMutationOptions),
      {
        document: UpdateMealPlanItemDocument,
        fallback: t('toasts.mealUpdateFailed'),
        onFailed: revertToggle,
        present: 'none',
      },
    );

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return false;
    }

    if (settled.status === 'applied') {
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

    return true;
  };

  const deleteItem = async (id: string) => {
    // Snapshot first so a server rejection can restore the meal.
    const snapshot = readItemSnapshot(id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // surfaces as NotFound, which the queue drops).
    try {
      if (mealPlanId) {
        removeFromMealPlanItems(client.cache, mealPlanId, id, {
          evictItem: true,
        });
      }
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Meal (optimistic)',
      });
    }

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

    const restoreItem = () => {
      if (!snapshot) return;
      try {
        writeItem(snapshot);
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
          context: { localFirst: true },
        }),
      {
        document: DeleteMealPlanItemDocument,
        fallback: t('mealTemplateBuilder.failedToRemoveItem'),
        removal: true,
        onFailed: restoreItem,
        present: 'none',
      },
    );

    // Released on every outcome — settling never throws, so this runs whether
    // the delete committed, was refused, or was queued.
    subscriptionService.unregisterPendingDelete(id);

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return false;
    }
    return true;
  };

  return {
    createItem,
    toggleCompleted,
    deleteItem,
    creating,
  };
}
