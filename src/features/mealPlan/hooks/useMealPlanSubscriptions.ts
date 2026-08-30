/**
 * Opens `mealPlanEvents(homeId)` and applies other members' changes; a personal
 * plan (`homeId: null`) emits none. The payload is an envelope plus an id —
 * subscriptions validate against depth 5, which no fragment spread fits — so
 * creates read the entity back and item changes ride `refreshPlanAggregates`.
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
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
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
import { useSubscriptionTransportRecovery } from '#hooks/subscriptions/useSubscriptionTransportRecovery';

type MealPlanEventsPayload = MealPlanEventsSubscription['mealPlanEvents'];

/**
 * The add updaters take an id, NEVER a read-back object: `toReference(item,
 * true)` merges what it is handed over the stored entity, so a denormalized
 * result would replace nested references with inline snapshots and un-normalize
 * them. The `readFragment` below is a completeness probe only.
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

    // The pick is persisted: left set, it survives into the next session
    // naming a deleted plan. Same reasoning as useActiveMealPlan.
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
 * Re-reads the plan so its server-computed nutrition totals catch up; evicting
 * them instead makes `MealPlanMain_mealPlan` incomplete and blanks the screen.
 * Debounced (a 7-day template pushes ~21 events) and held off while a delete is
 * pending — a refetch landing mid-delete writes the removed row back in.
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

      // This device's own writes already updated the cache locally — replaying
      // them here would fight the local-first path (re-adding a row mid-delete,
      // say). Keyed on the device, so the user's other devices still update.
      if (isSelfEcho(payload, userId)) {
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

  const mealPlanSkip = !selectedHomeId || !isHomeSelectionReady || rejected;
  const mealPlanEvents = useSubscription(MealPlanEventsDocument, {
    variables: { homeId: selectedHomeId! },
    skip: mealPlanSkip,
    // Same reason as `PantryEvents`: the envelope's `node` is `__typename` +
    // `id` only, and `MealPlanForEvent` / `GetMealPlan` read the entity back
    // over HTTP. Cached, a DELETE event re-creates the MealPlanItem it just
    // announced was gone as a bare `{ id }`, and the incomplete `GetMealPlan`
    // result costs a full-page refetch per delete.
    fetchPolicy: 'no-cache',
    ...eventHandlers,
  });
  useSubscriptionTransportRecovery(
    'MealPlanEvents',
    mealPlanEvents,
    mealPlanSkip,
  );
}
