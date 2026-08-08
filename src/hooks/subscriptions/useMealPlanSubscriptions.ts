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
 * Every subtype applies the pushed payload rather than refetching for it.
 * Apollo normalizes each event's node on arrival, so the handler's only job is
 * connection and array membership, which a normalized write cannot infer:
 *
 * The one exception is a meal plan's server-computed nutrition totals, which no
 * pushed node carries. Those go through `refreshPlanAggregates`, which is
 * debounced and waits out any in-flight delete — see its own note.
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
  GetMealPlanDocument,
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
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';
import { useIsHomeSelectionReady, useSelectedHomeId } from '#store/useAppStore';
import { useStore } from '#store/index';
import { logger } from '#/utils/environment';

type MealPlanEventsPayload = MealPlanEventsSubscription['mealPlanEvents'];

/**
 * The add updaters take an id, never a read-back object.
 *
 * They call `toReference(item, true)`, which merges whatever it is handed over
 * the stored entity, preferring the incoming value on every key. A denormalized
 * `readFragment` result would therefore overwrite nested entity references
 * (`MealPlan.home`, `MealPlanItem.recipe`) with inline snapshots, silently
 * un-normalizing them — the card would stop tracking the Recipe entity, and a
 * later query selecting a field outside the snapshot would read incomplete.
 * Apollo normalized the pushed entity when the event arrived, so the ref is all
 * these need; the `readFragment` calls below are completeness probes only.
 */
type EntityRef = { __typename: string; id: string };

const addToMealPlans = createAddToQueryConnectionUpdater<EntityRef>(
  'mealPlans',
  'MealPlan',
);

const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);

const addToMealTemplates = createAddToQueryConnectionUpdater<EntityRef>(
  'mealTemplates',
  'MealTemplate',
);

const removeFromMealTemplates = createRemoveFromQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);

const addToMealPlanItems = createAddToParentArrayUpdater<EntityRef>(
  'MealPlan',
  'mealPlanItems',
);

const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

const addToMealTemplateItems = createAddToParentArrayUpdater<EntityRef>(
  'MealTemplate',
  'items',
);

const removeFromMealTemplateItems = createRemoveFromParentArrayUpdater(
  'MealTemplate',
  'items',
  'MealTemplateItem',
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
    // Pass the id, never the read-back object. The updaters call
    // `toReference(item, true)`, which merges what it is given over the stored
    // entity — handing back the denormalized read would overwrite `home` /
    // `user` / `createdBy` refs with inline snapshots and un-normalize them.
    // The read above is the completeness probe; the entity itself is already
    // in the store, normalized by Apollo when the event arrived.
    addToMealPlans(
      client.cache,
      { __typename: 'MealPlan', id: planId },
      {
        position: 'start',
      },
    );
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

/** Debounce window for the aggregates refetch. */
const AGGREGATE_REFRESH_DELAY_MS = 400;
/**
 * Retry ceiling while deletes are in flight. `registerPendingDelete` self-clears
 * after 30s, so this only has to outlast that — it exists to bound the loop, not
 * to time it.
 */
const AGGREGATE_REFRESH_MAX_ATTEMPTS = 80;

let aggregateRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Re-read the plan so its server-computed nutrition totals catch up.
 *
 * The totals are their own fields, so changing `mealPlanItems` leaves them
 * describing the old set. They can't be evicted — `MealPlanMain_mealPlan`
 * selects them, and an evicted field makes that read incomplete and blanks the
 * screen — so the only fix is a re-read. Refetches only what is mounted;
 * offline the totals stay stale until the next successful read, which beats
 * blanking.
 *
 * Coalesced and delete-aware, because a naive refetch-per-event is wrong twice
 * over. Applying a 7-day template pushes ~21 item events, and one full plan
 * query each is 21 round-trips for one final answer. Worse, a refetch landing
 * while a delete is still in flight writes the server's copy of the row the
 * user just removed straight back into the cache — the deleted meal reappears,
 * then vanishes again when the delete's own echo arrives. So: debounce, and
 * hold off entirely until no delete is pending.
 */
function refreshPlanAggregates(
  client: SubscriptionApolloClient,
  attempt: number = 0,
) {
  if (aggregateRefreshTimer) clearTimeout(aggregateRefreshTimer);
  aggregateRefreshTimer = setTimeout(() => {
    aggregateRefreshTimer = null;
    if (
      subscriptionService.hasPendingDeletes() &&
      attempt < AGGREGATE_REFRESH_MAX_ATTEMPTS
    ) {
      refreshPlanAggregates(client, attempt + 1);
      return;
    }
    void client.refetchQueries({ include: [GetMealPlanDocument] });
  }, AGGREGATE_REFRESH_DELAY_MS);
}

function handlePlanItemChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  const planId = payload.mealPlanId;
  if (!planId) return;

  // `node` is nullable, and a hard-deleted row is the shape most likely to
  // arrive without one. The event carries no item id of its own, so there is
  // nothing to remove by hand — re-read the plan instead of dropping the event.
  if (payload.node?.__typename !== 'MealPlanItem') {
    refreshPlanAggregates(client);
    return;
  }

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
    // The echo is dropped, but the plan's totals still moved. Scheduling here
    // is what makes the user's own delete — the common case, where the echo
    // almost always arrives while the mutation is still in flight — update the
    // calories/protein/carbs/fat in the header. The scheduler waits out the
    // pending delete before it reads.
    refreshPlanAggregates(client);
    return;
  }

  if (isDelete(payload.mutation)) {
    removeFromMealPlanItems(client.cache, planId, itemId, { evictItem: true });
    refreshPlanAggregates(client);
    return;
  }

  // Apollo has already normalized the pushed entity by the time this runs, so
  // an update needs nothing further — only membership of the parent array does.
  // An update still moves the totals, though.
  if (!isAdd(payload.mutation)) {
    refreshPlanAggregates(client);
    return;
  }

  const item =
    client.cache.readFragment<MealPlanItemActions_OptimisticFullItemFragment>({
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      from: { __typename: 'MealPlanItem', id: itemId },
    });

  if (!item) {
    // The push didn't carry every field the screens require. Adding it anyway
    // would make MealPlanMain's fragment read incomplete and blank the screen,
    // so re-read the plan rather than dropping the meal silently.
    if (__DEV__) {
      logger.warn(
        `[Subscription] MealPlanEvents payload incomplete for MealPlanItem (${itemId}) — refetching`,
      );
    }
    refreshPlanAggregates(client);
    return;
  }

  // The id, not the read-back object — see handlePlanChanged. Handing the
  // denormalized read to the updater would inline `recipe` over its Recipe ref.
  addToMealPlanItems(
    client.cache,
    planId,
    { __typename: 'MealPlanItem', id: itemId },
    { position: 'end' },
  );
  refreshPlanAggregates(client);
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

  // The id, not the read-back object — see handlePlanChanged.
  //
  // Scoped to the variants this template belongs to: `Query.mealTemplates` is
  // keyed on `filters`, so the browser sheet accumulates one entry per
  // category/search the user has visited and a bare cache.modify would drop a
  // remotely-created DINNER template into the BREAKFAST list.
  addToMealTemplates(
    client.cache,
    { __typename: 'MealTemplate', id: templateId },
    {
      position: 'start',
      skipStoreField: skipUnmatchedFilterVariants({
        category: template.category,
      }),
    },
  );
}

function handleTemplateItemChanged(
  payload: MealPlanEventsPayload,
  client: SubscriptionApolloClient,
) {
  const templateId = payload.templateId;

  // Updates normalize themselves.
  if (!templateId || payload.mutation === MutationType.Updated) return;

  // Without the node there is no item id to act on — fall back to the network.
  if (payload.node?.__typename !== 'MealTemplateItem') {
    void client.refetchQueries({ include: [GetMealTemplateDocument] });
    return;
  }

  // Apply locally, like the plan-item path. A refetch would reach neither an
  // offline device nor `GetMealTemplateForEdit`, which isn't in `include`.
  const itemId = payload.node.id;

  if (isDelete(payload.mutation)) {
    removeFromMealTemplateItems(client.cache, templateId, itemId, {
      evictItem: true,
    });
    return;
  }

  addToMealTemplateItems(
    client.cache,
    templateId,
    { __typename: 'MealTemplateItem', id: itemId },
    { position: 'end' },
  );
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
