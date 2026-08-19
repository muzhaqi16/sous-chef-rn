/**
 * Meal Plan Subscriptions
 *
 * Opens the consolidated `mealPlanEvents(homeId)` stream for the selected home
 * and applies plan / plan-item / template changes made by other members —
 * previously invisible to this client until a refetch happened to land.
 *
 * A personal plan (`homeId: null`) can only be changed by this device, so it
 * emits no events and needs none.
 *
 * The event carries the envelope plus the changed entity's id — subscriptions
 * are validated against depth 5, which no fragment spread fits under. Deletes
 * work from the id alone; creates read the entity back first; plan-item changes
 * ride the debounced `refreshPlanAggregates` read.
 */

import { useSubscription } from '@apollo/client/react';
import {
  MealPlanEventsDocument,
  MealPlanForEventDocument,
  GetMealPlanDocument,
  type MealPlanEventsSubscription,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  GetMealTemplateDocument,
  MealTemplateForEventDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { fetchEventEntity } from '#/services/subscriptions/fetchEventEntity';
import { useSubscriptionRejected } from '#/services/subscriptions/rejectedSubscriptions';
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
 * The read-back query has already written the entity, so the ref is all these
 * need; the `readFragment` call below is a completeness probe only.
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

async function handlePlanChanged(
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

  // The event carries no values, so an update needs the plan re-read.
  if (!isAdd(payload.mutation)) {
    refreshPlanAggregates(client);
    return;
  }

  // A create joins the overview connection, which needs the canonical list-card
  // shape — adding a plan the overview can't read completely blanks the list.
  const data = await fetchEventEntity(
    client,
    MealPlanForEventDocument,
    { id: planId },
    'MealPlan',
  );
  if (!data?.mealPlan) return;

  // The id, not the read-back object — see the EntityRef note above.
  addToMealPlans(
    client.cache,
    { __typename: 'MealPlan', id: planId },
    { position: 'start' },
  );
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

  // Add and update both ride the plan read: it returns `mealPlanItems` and the
  // totals in one response, and applying a 7-day template pushes ~21 events
  // that a per-item read would turn into 21 requests.
  refreshPlanAggregates(client);
}

async function handleTemplateChanged(
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

  // No always-mounted template query, so this reaches the browser sheet only
  // while it is open — the only time an update is visible.
  if (!isAdd(payload.mutation)) {
    void client.refetchQueries({ include: [GetMealTemplateDocument] });
    return;
  }

  // A create has to join the list connection: the browser sheet's query mounts
  // once with the screen, so reopening it doesn't refetch.
  const data = await fetchEventEntity(
    client,
    MealTemplateForEventDocument,
    { id: templateId },
    'MealTemplate',
  );
  if (!data?.mealTemplate) return;

  const template = client.cache.readFragment<MealTemplateDisplayFragment>({
    fragment: MealTemplateDisplayFragmentDoc,
    fragmentName: 'MealTemplateDisplay',
    from: { __typename: 'MealTemplate', id: templateId },
  });
  if (!template) return;

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
  const rejected = useSubscriptionRejected('MealPlanEvents');

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
          void handlePlanChanged(payload, client);
          break;

        case MealPlanSubtype.MealPlanItemChanged:
          handlePlanItemChanged(payload, client);
          break;

        case MealPlanSubtype.MealTemplateChanged:
          void handleTemplateChanged(payload, client);
          break;

        case MealPlanSubtype.MealTemplateItemChanged:
          handleTemplateItemChanged(payload, client);
          break;
      }
    },
  });

  useSubscription(MealPlanEventsDocument, {
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId || !isHomeSelectionReady || rejected,
    ...eventHandlers,
  });
}
