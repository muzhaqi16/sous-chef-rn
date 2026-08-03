/**
 * useMealPlanActions - Meal plan create / update / delete (local-first).
 *
 * Each operation writes its change to the cache PERMANENTLY before firing, so
 * it survives an offline / API-down queue (an `optimisticResponse` would roll
 * back the moment the queue completes the request with a null result):
 * - create: mints the permanent cuid PK, materializes a complete
 *   `MealPlanDisplay` entity (creator + home resolved from cache) and adds the
 *   overview connection edge — the queued replay re-sends the original
 *   mutation keyed by that id.
 * - update: merges the changed fields over a snapshot; a rejection restores it.
 * - delete: removes edge + entity up front; a rejection restores the snapshot.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanDisplayFragmentDoc,
  type MealPlanDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  UseMealPlanActions_CreatorFragmentDoc,
  type UseMealPlanActions_CreatorFragment,
  UseMealPlanActions_HomeFragmentDoc,
  type UseMealPlanActions_HomeFragment,
  UseMealPlanActions_DetailStubFragmentDoc,
  type UseMealPlanActions_DetailStubFragment,
} from './useMealPlanActions.generated';
import {
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { useUser } from '#store/useAppStore';

const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

/** Queued create/update results reported to callers as success. */
const QUEUED_CREATE_PAYLOAD: { __typename: 'CreateMealPlanPayload' } = {
  __typename: 'CreateMealPlanPayload',
};
const QUEUED_UPDATE_PAYLOAD: { __typename: 'UpdateMealPlanPayload' } = {
  __typename: 'UpdateMealPlanPayload',
};

/**
 * Materialize a complete `MealPlanDisplay` entity for a local-first create.
 * Creator identity and home display fields come from the cache's canonical
 * entities; both degrade gracefully (profile-less creator, null home) when the
 * cache copy is incomplete — the post-replay refetch heals the gap.
 */
function buildOptimisticMealPlan(
  cache: ApolloCache,
  id: string,
  input: CreateMealPlanInput,
  creatorId: string,
): MealPlanDisplayFragment {
  const creatorCacheId = cache.identify({ __typename: 'User', id: creatorId });
  const cachedCreator = creatorCacheId
    ? cache.readFragment<UseMealPlanActions_CreatorFragment>({
        id: creatorCacheId,
        fragment: UseMealPlanActions_CreatorFragmentDoc,
        fragmentName: 'useMealPlanActions_creator',
      })
    : null;

  const homeCacheId = input.homeId
    ? cache.identify({ __typename: 'Home', id: input.homeId })
    : undefined;
  const home = homeCacheId
    ? cache.readFragment<UseMealPlanActions_HomeFragment>({
        id: homeCacheId,
        fragment: UseMealPlanActions_HomeFragmentDoc,
        fragmentName: 'useMealPlanActions_home',
      })
    : null;

  const now = new Date().toISOString();
  return {
    __typename: 'MealPlan',
    id,
    name: input.name,
    description: input.description ?? null,
    planType: input.planType,
    startDate: input.startDate,
    endDate: input.endDate,
    servings: input.servings ?? 2,
    totalCalories: null,
    totalProtein: null,
    totalCarbs: null,
    totalFat: null,
    actualCost: 0,
    budgetAmount: input.budgetAmount ?? null,
    homeId: input.homeId ?? null,
    home,
    // The creator of a new plan is also its owner — used for permission gating.
    user: {
      __typename: 'User',
      id: creatorId,
    },
    createdBy: cachedCreator ?? {
      __typename: 'User',
      id: creatorId,
      profile: null,
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A meal plan created offline must render on its complete-gated detail screen —
 * `useMealPlan` reads `MealPlanMain_mealPlan` and returns null unless the whole
 * fragment is `complete`. Materialize the detail-only fields (zeroed nutrition,
 * no goal progress, empty items) alongside the `MealPlanDisplay` write so the
 * fragment is complete until the server response / queued replay fills real
 * values. Reuses the resolved `home` / `createdBy` from the display entity.
 */
function buildMealPlanDetailStub(
  planId: string,
): UseMealPlanActions_DetailStubFragment {
  return {
    __typename: 'MealPlan',
    id: planId,
    mealPlanItems: [],
    nutritionSummary: {
      __typename: 'MealPlanNutritionSummary',
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      avgDailyCalories: 0,
      avgDailyProtein: 0,
      avgDailyCarbs: 0,
      avgDailyFat: 0,
      totalMeals: 0,
      mealsWithNutrition: 0,
      coveragePercentage: 0,
      mealTypeBreakdown: [],
    },
    nutritionGoalProgress: null,
  };
}

/** Fields an update can change that live on the cached `MealPlanDisplay`. */
function mergeUpdateIntoSnapshot(
  snapshot: MealPlanDisplayFragment,
  input: Omit<UpdateMealPlanInput, 'id'>,
): MealPlanDisplayFragment {
  return {
    ...snapshot,
    ...(input.name != null && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.planType != null && { planType: input.planType }),
    ...(input.startDate != null && { startDate: input.startDate }),
    ...(input.endDate != null && { endDate: input.endDate }),
    ...(input.servings != null && { servings: input.servings }),
    ...(input.budgetAmount !== undefined && {
      budgetAmount: input.budgetAmount,
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function useMealPlanActions() {
  const client = useApolloClient();
  const user = useUser();

  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    {
      update: (cache, { data }) => {
        const result = data?.createMealPlan;
        if (result?.__typename === 'CreateMealPlanPayload') {
          addToMealPlans(cache, result.mealPlan, { position: 'start' });
        }
      },
    },
  );

  const [updateMealPlanMutation, { loading: updating }] = useMutation(
    UpdateMealPlanDocument,
  );

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
    {
      onError: error => {
        handleMutationError(error, { operation: 'Delete Meal Plan' });
      },
    },
  );

  const writePlan = (data: MealPlanDisplayFragment) =>
    client.cache.writeFragment({
      id: client.cache.identify(data),
      fragment: MealPlanDisplayFragmentDoc,
      fragmentName: 'MealPlanDisplay',
      data,
    });

  const writePlanDetailStub = (planId: string) =>
    client.cache.writeFragment({
      id: client.cache.identify({ __typename: 'MealPlan', id: planId }),
      fragment: UseMealPlanActions_DetailStubFragmentDoc,
      fragmentName: 'useMealPlanActions_detailStub',
      data: buildMealPlanDetailStub(planId),
    });

  const readPlanSnapshot = (id: string) => {
    const cacheId = client.cache.identify({ __typename: 'MealPlan', id });
    return cacheId
      ? client.cache.readFragment<MealPlanDisplayFragment>({
          id: cacheId,
          fragment: MealPlanDisplayFragmentDoc,
          fragmentName: 'MealPlanDisplay',
        })
      : null;
  };

  const createMealPlan = async (input: CreateMealPlanInput) => {
    // Local-first: mint the permanent cuid (the row's real PK) and write the
    // plan into the cache before firing, so creation works fully offline.
    const id = generateEntityId();
    const optimisticPlan = user
      ? buildOptimisticMealPlan(client.cache, id, input, user.id)
      : null;
    if (optimisticPlan) {
      executeCacheUpdate(() => {
        writePlan(optimisticPlan);
        // Make the complete-gated detail screen render offline too.
        writePlanDetailStub(id);
        addToMealPlans(client.cache, optimisticPlan, { position: 'start' });
      }, 'Create Meal Plan (optimistic)');
    }

    const result = await executeMutation(
      () =>
        createMealPlanMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Create Meal Plan error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      if (optimisticPlan) {
        executeCacheUpdate(
          () => removeFromMealPlans(client.cache, id, { evictItem: true }),
          'Revert rejected Meal Plan',
        );
      }
      return result ? result.data?.createMealPlan ?? null : null;
    }
    if (outcome === 'queued' && optimisticPlan) {
      // Offline / API down: the plan stays in cache and the create replays
      // keyed by the same id — report success to the caller.
      return QUEUED_CREATE_PAYLOAD;
    }
    return result ? result.data?.createMealPlan ?? null : null;
  };

  const updateMealPlan = async (
    id: string,
    input: Omit<UpdateMealPlanInput, 'id'>,
  ) => {
    const snapshot = readPlanSnapshot(id);
    // Permanent write BEFORE firing — survives an offline/API-down queue.
    if (snapshot) {
      executeCacheUpdate(
        () => writePlan(mergeUpdateIntoSnapshot(snapshot, input)),
        'Update Meal Plan (optimistic)',
      );
    }

    const result = await executeMutation(
      () =>
        updateMealPlanMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      'Update Meal Plan error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      if (snapshot) {
        executeCacheUpdate(
          () => writePlan(snapshot),
          'Revert rejected Meal Plan update',
        );
      }
      return result ? result.data?.updateMealPlan ?? null : null;
    }
    if (outcome === 'queued' && snapshot) {
      return QUEUED_UPDATE_PAYLOAD;
    }
    return result ? result.data?.updateMealPlan ?? null : null;
  };

  const deleteMealPlan = async (id: string) => {
    // Snapshot first so a server rejection can restore the plan card.
    const snapshot = readPlanSnapshot(id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // surfaces as NotFound, which the queue drops).
    executeCacheUpdate(
      () => removeFromMealPlans(client.cache, id, { evictItem: true }),
      'Delete Meal Plan (optimistic)',
    );

    const result = await executeMutation(
      () =>
        deleteMealPlanMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Delete Meal Plan error:',
    );

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      if (snapshot) {
        executeCacheUpdate(() => {
          writePlan(snapshot);
          addToMealPlans(client.cache, snapshot, { position: 'start' });
        }, 'Restore refused Meal Plan delete');
      }
      return false;
    }
    return true;
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
