/**
 * Meal Plan Subscriptions
 *
 * Opens the consolidated `mealPlanEvents(homeId)` stream for the selected home
 * and applies plan / plan-item / template changes made by other members —
 * previously invisible to this client until a refetch happened to land.
 *
 * Scope note: the stream is home-scoped, and so is the sharing. A personal
 * plan (`homeId: null`) can only be changed by this device, so there is
 * nothing to push and nothing missed.
 *
 * Every subtype applies the pushed payload — no refetch on the happy path.
 * Apollo normalizes each event's node on arrival, so the handler's only job is
 * connection and array membership, which a normalized write cannot infer:
 *
 * - **Plans and plan items** join or leave their collection using the entity
 *   read back from the cache. Reading back rather than trusting the payload is
 *   what keeps a drifted selection from writing a partial entity into a
 *   collection — an incomplete read blanks the whole list, so the handler
 *   falls back to a refetch in that case instead.
 * - **Updates** need nothing at all: normalization already applied them.
 * - **Deletes** need no data beyond the id, and they clear the persisted
 *   selection when it names the deleted plan — the live counterpart to
 *   `useActiveMealPlan`'s read-failure fallback.
 */

import { useSubscription } from '@apollo/client/react';
import {
  MealPlanEventsDocument,
  GetMealPlansDocument,
  type MealPlanEventsSubscription,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  type MealPlanItemActions_OptimisticFullItemFragment,
} from '#features/mealPlan/hooks/useMealPlanItemActions.generated';
import {
  MealPlanDisplayFragmentDoc,
  type MealPlanDisplayFragment,
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { MealPlanSubtype, MutationType } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentArrayUpdater,
  createAddToQueryConnectionUpdater,
  createRemoveFromParentArrayUpdater,
  createRemoveFromQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useIsHomeSelectionReady, useSelectedHomeId } from '#store/useAppStore';
import { useStore } from '#store/index';
import { logger } from '#/utils/environment';

type MealPlanEventsPayload = MealPlanEventsSubscription['mealPlanEvents'];

const addToMealPlans =
  createAddToQueryConnectionUpdater<MealPlanDisplayFragment>(
    'mealPlans',
    'MealPlan',
  );

const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

const addToMealTemplates =
  createAddToQueryConnectionUpdater<MealTemplateDisplayFragment>(
    'mealTemplates',
    'MealTemplate',
  );

const removeFromMealTemplates = createRemoveFromQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

// The fragment is a composition of cell fragments and selects no field of its
// own, so its type carries only `__typename` + refs. The entity always has an
// id — the handler supplies it from the event, which is where the read started.
type PushedMealPlanItem = MealPlanItemActions_OptimisticFullItemFragment & {
  id: string;
};

const addToMealPlanItems = createAddToParentArrayUpdater<PushedMealPlanItem>(
  'MealPlan',
  'mealPlanItems',
);

const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

const isDelete = (mutation: MutationType) =>
  mutation === MutationType.Deleted || mutation === MutationType.ItemRemoved;

const isAdd = (mutation: MutationType) =>
  mutation === MutationType.Created || mutation === MutationType.ItemAdded;

function handlePlanChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  const planId =
    payload.node?.__typename === 'MealPlan'
      ? payload.node.id
      : payload.mealPlanId;
  if (!planId) return;

  if (isDelete(payload.mutation)) {
    removeFromMealPlans(client.cache, planId, { evictItem: true });

    // Same reasoning as useActiveMealPlan: the pick is persisted, so left set
    // it survives into the next session naming a plan that no longer exists.
    const store = useStore.getState();
    if (store.selectedMealPlanId === planId) {
      store.setSelectedMealPlanId(null);
    }
    return;
  }

  // Apollo normalized the pushed plan on arrival — aliases and all, since it
  // keys by field name — so an update needs nothing further. A create still
  // has to join the overview connection, which requires the canonical
  // list-card shape.
  if (!isAdd(payload.mutation)) return;

  const plan = client.cache.readFragment<MealPlanDisplayFragment>({
    fragment: MealPlanDisplayFragmentDoc,
    fragmentName: 'MealPlanDisplay',
    from: { __typename: 'MealPlan', id: planId },
  });

  if (plan) {
    addToMealPlans(client.cache, plan, { position: 'start' });
    return;
  }

  // The push didn't satisfy `MealPlanDisplay` — the subscription's selection
  // has drifted from the fragment. Adding a partial plan would make the
  // overview's read incomplete and blank the list, so pay for a refetch
  // instead. Only active queries refetch; nothing happens with no list mounted.
  if (__DEV__) {
    logger.warn(
      `[Subscription] MealPlanEvents payload incomplete for MealPlanDisplay (${planId}) — refetching`,
    );
  }
  void client.refetchQueries({ include: [GetMealPlansDocument] });
}

function handlePlanItemChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  if (payload.node?.__typename !== 'MealPlanItem') return;
  const planId = payload.mealPlanId;
  if (!planId) return;

  const itemId = payload.node.id;

  // The user is mid-delete on this row locally; applying a remote echo now
  // would fight the optimistic removal.
  if (subscriptionService.isPendingDelete(itemId)) {
    if (__DEV__) {
      logger.debug(
        '⏭️ [Subscription] Skipping meal plan item echo for pending-delete',
        itemId,
      );
    }
    return;
  }

  if (isDelete(payload.mutation)) {
    removeFromMealPlanItems(client.cache, planId, itemId, { evictItem: true });
    return;
  }

  // Apollo has already normalized the pushed entity by the time this runs, so
  // an update needs nothing further — only membership of the parent array does.
  if (!isAdd(payload.mutation)) return;

  const item =
    client.cache.readFragment<MealPlanItemActions_OptimisticFullItemFragment>({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: { __typename: 'MealPlanItem', id: itemId },
    });
  // Incomplete read: the push didn't carry every field the screens require.
  // Adding it anyway would make MealPlanMain's fragment read incomplete and
  // blank the screen, so leave the array alone and let a refetch heal it.
  if (!item) return;

  addToMealPlanItems(
    client.cache,
    planId,
    { ...item, id: itemId },
    {
      position: 'end',
    },
  );
}

function handleTemplateChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  const templateId =
    payload.node?.__typename === 'MealTemplate'
      ? payload.node.id
      : payload.templateId;
  if (!templateId) return;

  if (isDelete(payload.mutation)) {
    removeFromMealTemplates(client.cache, templateId, { evictItem: true });
    return;
  }

  // Same shape as the plan path: normalization covers an update, a create still
  // has to join the list connection. Leaving that to the next cache-and-network
  // read isn't enough — the template browser is a sheet whose query mounts once
  // with the screen, so reopening it doesn't refetch, and the list would stay
  // live for deletes while going stale for additions.
  if (!isAdd(payload.mutation)) return;

  const template = client.cache.readFragment<MealTemplateDisplayFragment>({
    fragment: MealTemplateDisplayFragmentDoc,
    fragmentName: 'MealTemplateDisplay',
    from: { __typename: 'MealTemplate', id: templateId },
  });
  if (!template) {
    // Incomplete read — adding a partial template would blank the list, so let
    // a later read heal it instead. No refetch: unlike the plan overview,
    // there is no always-mounted template query for one to reach.
    if (__DEV__) {
      logger.warn(
        `[Subscription] MealPlanEvents payload incomplete for MealTemplateDisplay (${templateId})`,
      );
    }
    return;
  }

  addToMealTemplates(client.cache, template, { position: 'start' });
}

function handleTemplateItemChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  // Updates normalize themselves. Membership changes need the template's own
  // query, which refetches only if a template screen is currently mounted.
  if (payload.mutation === MutationType.Updated) return;
  void client.refetchQueries({ include: [GetMealTemplateDocument] });
}

/**
 * Initialize meal plan subscriptions for the current user.
 *
 * @param userId - Current user ID, for self-echo filtering and deduplication
 */
export function useMealPlanSubscriptions(userId?: string) {
  const selectedHomeId = useSelectedHomeId() || undefined;
  const isHomeSelectionReady = useIsHomeSelectionReady();

  const eventHandlers = subscriptionService.register<MealPlanEventsPayload>({
    subscriptionName: 'MealPlanEvents',
    entityType: 'MealPlan',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedHomeId,
    customOnData: (
      payload: MealPlanEventsPayload,
      client: SubscriptionApolloClient,
    ) => {
      if (!payload) return;

      // Our own writes already updated the cache locally — replaying them here
      // would fight the local-first path (re-adding a row mid-delete, say).
      if (payload.actorUserId && userId && payload.actorUserId === userId) {
        if (__DEV__) {
          logger.debug('⏭️ [Subscription] Skipping meal plan self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        case MealPlanSubtype.MealPlanChanged:
          handlePlanChanged(payload, client);
          break;

        case MealPlanSubtype.MealPlanItemChanged:
          handlePlanItemChanged(payload, client);
          break;

        case MealPlanSubtype.MealTemplateChanged:
          handleTemplateChanged(payload, client);
          break;

        case MealPlanSubtype.MealTemplateItemChanged:
          handleTemplateItemChanged(payload, client);
          break;
      }
    },
  });

  useSubscription(MealPlanEventsDocument, {
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId || !isHomeSelectionReady,
    ...eventHandlers,
  });
}
