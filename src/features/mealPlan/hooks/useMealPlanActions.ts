/**
 * Meal plan create / update / delete, local-first: each writes the cache
 * PERMANENTLY before firing, since an `optimisticResponse` rolls back when the
 * queue completes with a null result. Create mints the cuid PK the replay
 * re-sends under; update and delete snapshot and restore on a failure.
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
import { NEUTRAL_MEAL_PLAN_DETAIL } from './mealPlanDetailNeutral.generated';
import type {
  CreateMealPlanInput,
  UpdateMealPlanInput,
} from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useUser } from '#store/useAppStore';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

const addToMealPlans = createAddToQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

/** A plan create as its caller acts on it; `failure` is what to show. */
export type MealPlanCreateOutcome =
  | { status: 'applied' | 'queued' }
  | { status: 'failed'; failure: SettledFailure };

interface CreateMealPlanOptions {
  /** `'none'` leaves the failure to the caller, e.g. to show on a form field. */
  present?: 'alert' | 'none';
}

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
 * `useMealPlan` returns null unless `MealPlanMain_mealPlan` is `complete`, so an
 * offline-created plan needs its detail-only fields too. The values are the
 * SDL-derived neutral base (`scripts/generate-optimistic-fillers.mjs`), so a new
 * fragment field cannot be forgotten here — invisible until the screen blanks.
 */
function buildMealPlanDetailStub(
  planId: string,
): UseMealPlanActions_DetailStubFragment {
  return { ...NEUTRAL_MEAL_PLAN_DETAIL, id: planId };
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
  const { t } = useTranslation();

  const [createMealPlanMutation, { loading: creating }] = useMutation(
    CreateMealPlanDocument,
    {
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (payload)
          addToMealPlans(cache, payload.mealPlan, { position: 'start' });
      },
    },
  );

  const [updateMealPlanMutation] = useMutation(UpdateMealPlanDocument);

  const [deleteMealPlanMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanDocument,
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

  const createMealPlan = async (
    input: CreateMealPlanInput,
    { present }: CreateMealPlanOptions = {},
  ): Promise<MealPlanCreateOutcome> => {
    // Local-first: mint the permanent cuid (the row's real PK) and write the
    // plan into the cache before firing, so creation works fully offline. A
    // caller deriving a plan mints it first, since its items name it as parent.
    const id = input.id ?? generateEntityId();
    // The cache write below publishes this id to every consumer, including the
    // detail query on MealPlanMain. Hold that query off until the server has a
    // row to answer with — see `unconfirmedCreates`.
    unconfirmedCreates.mark(id);
    const optimisticPlan = user
      ? buildOptimisticMealPlan(client.cache, id, input, user.id)
      : null;
    if (optimisticPlan) {
      try {
        writePlan(optimisticPlan);
        // Make the complete-gated detail screen render offline too.
        writePlanDetailStub(id);
        addToMealPlans(client.cache, optimisticPlan, { position: 'start' });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Create Meal Plan (optimistic)',
        });
      }
    }

    const revertCreate = () => {
      if (!optimisticPlan) return;
      try {
        removeFromMealPlans(client.cache, id, { evictItem: true });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal Plan',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        createMealPlanMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      {
        document: CreateMealPlanDocument,
        fallback: t('mealPlan.failedToCreate'),
        onFailed: revertCreate,
        present,
      },
    );

    // Released on every outcome: acknowledged and rejected both leave nothing
    // for a detail read to miss, and a queued create has already been handed
    // off to `queueStore` by the time the mutation resolves.
    unconfirmedCreates.confirm(id);

    if (settled.failure) return { status: 'failed', failure: settled.failure };
    // Offline / API down: the plan stays in cache and the create replays keyed
    // by the same id.
    return { status: settled.status === 'queued' ? 'queued' : 'applied' };
  };

  /** `true` once the change landed or is queued; `false` when it reverted. */
  const updateMealPlan = async (
    id: string,
    input: Omit<UpdateMealPlanInput, 'id'>,
  ): Promise<boolean> => {
    const snapshot = readPlanSnapshot(id);
    // Permanent write BEFORE firing — survives an offline/API-down queue.
    if (snapshot) {
      try {
        writePlan(mergeUpdateIntoSnapshot(snapshot, input));
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Update Meal Plan (optimistic)',
        });
      }
    }

    const revertUpdate = () => {
      if (!snapshot) return;
      try {
        writePlan(snapshot);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Meal Plan update',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        updateMealPlanMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        }),
      {
        document: UpdateMealPlanDocument,
        fallback: t('errors.saveFailed'),
        onFailed: revertUpdate,
      },
    );
    return settled.status !== 'failed';
  };

  const deleteMealPlan = async (id: string) => {
    // Snapshot first so a server rejection can restore the plan card.
    const snapshot = readPlanSnapshot(id);

    // Local-first: remove from the cache BEFORE firing, so the deletion is
    // visible immediately and survives an offline queue (a duplicate replay
    // surfaces as NotFound, which counts as deleted).
    try {
      removeFromMealPlans(client.cache, id, { evictItem: true });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Meal Plan (optimistic)',
      });
    }

    const restorePlan = () => {
      if (!snapshot) return;
      try {
        writePlan(snapshot);
        addToMealPlans(client.cache, snapshot, { position: 'start' });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Restore refused Meal Plan delete',
        });
      }
    };

    const settled = await settleMutation(
      () =>
        deleteMealPlanMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: DeleteMealPlanDocument,
        fallback: t('mealPlanMain.deleteMealPlanFailed'),
        removal: true,
        onFailed: restorePlan,
      },
    );
    return settled.status !== 'failed';
  };

  return {
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    creating,
    deleting,
  };
}
