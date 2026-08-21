/**
 * User Subscriptions
 *
 * Centralizes user-related real-time updates using the unified
 * SubscriptionService. Opens a single consolidated `userEvents(userId)` stream
 * carrying account updates, profile changes, and lifecycle events
 * (membership/moderation), discriminated by `subtype` — replacing the former
 * userUpdated + userProfileChanged + userLifecycleEvents subscriptions. One
 * stream keeps the per-user concurrent-subscription count low (the server caps
 * it cluster-wide).
 *
 * - ACCOUNT_UPDATED (User node) / PROFILE_CHANGED (UserProfile node): Apollo
 *   auto-normalizes the entity by id — no manual cache work.
 * - Lifecycle subtypes: membership add/remove + moderation (ban/suspend/warn),
 *   with context (parents / reason / warningCount) carried on the envelope.
 */

import { useApolloClient, useSubscription } from '@apollo/client/react';
import {
  UserEventsDocument,
  type UserEventsSubscription,
} from '#operations/auth/user.generated';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { UserSubtype } from '#/graphql/generated/schemaTypes';
import { useSelectedHomeId } from '#store/useAppStore';
import { useStore } from '#store/index';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';
import { toastService } from '#/services/toastService';
import { authService } from '#/services/authService';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

type UserEventPayload = UserEventsSubscription['userEvents'];

function handleRemovedFromHome(
  payload: UserEventPayload,
  client: SubscriptionApolloClient,
  selectedHomeId: string | null,
) {
  const homeId = payload.parents?.homeId;
  if (!homeId) return;

  safeEvict(client.cache, 'Home', homeId);

  if (homeId === selectedHomeId) {
    // `homes` is a HomeConnection (edges/pageInfo), not a flat array — read it
    // typed and unwrap via extractNodes. Exclude the home we were just removed
    // from in case the eviction hasn't propagated to the connection yet.
    const cachedData = client.cache.readQuery<GetHomesQuery>({
      query: GetHomesDocument,
    });
    const remaining = extractNodes(cachedData?.homes).filter(
      home => home.id !== homeId,
    );

    const store = useStore.getState();
    if (remaining.length > 0) {
      store.setSelectedHomeId(remaining[0].id);
    } else {
      store.setSelectedHomeId(null);
    }
    store.setSelectedPantryId(null);
    store.setSelectedShoppingListId(null);
    // The meal plan pick is persisted like the other two. Left set, it keeps
    // naming a plan in the home we just lost, and every detail read for it
    // comes back FORBIDDEN.
    store.setSelectedMealPlanId(null);
  }

  toastService.error(t('accountEvents.removedFromHome'));
}

function handleAddedToHome(client: SubscriptionApolloClient) {
  client.refetchQueries({ include: [GetHomesDocument] });
  toastService.success(t('accountEvents.addedToHome'));
}

function handleRemovedFromShoppingList(
  payload: UserEventPayload,
  client: SubscriptionApolloClient,
) {
  const listId = payload.parents?.shoppingListId;
  if (!listId) return;

  safeEvict(client.cache, 'ShoppingList', listId);

  const store = useStore.getState();
  if (store.selectedShoppingListId === listId) {
    store.setSelectedShoppingListId(null);
  }

  toastService.error(t('accountEvents.removedFromShoppingList'));
}

function handleAddedToShoppingList() {
  toastService.success(t('accountEvents.addedToShoppingList'));
}

function handleBannedOrSuspended(
  payload: UserEventPayload,
  subtype: UserSubtype,
) {
  const reason = payload.reason
    ? getI18n().t('accountEvents.reasonSuffix', { reason: payload.reason })
    : '';
  const message =
    subtype === UserSubtype.Banned
      ? getI18n().t('accountEvents.accountBanned', { reason })
      : getI18n().t('accountEvents.accountSuspended', { reason });
  toastService.error(message);
  authService.logout();
}

/**
 * Initialize user subscriptions for multi-device profile/settings sync
 * and lifecycle events (membership changes, moderation actions).
 *
 * @param userId - Current user ID for deduplication and subscription scoping
 */
export function useUserSubscriptions(userId?: string) {
  const client = useApolloClient();
  const selectedHomeId = useSelectedHomeId() || null;

  const userEventHandlers = subscriptionService.register<UserEventPayload>({
    subscriptionName: 'UserEvents',
    entityType: 'User',
    enableDeduplication: false,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    customOnData: (payload: UserEventPayload) => {
      if (!payload) return;

      switch (payload.subtype) {
        // Apollo auto-normalizes the User / UserProfile node by id; no manual
        // cache work needed (mirrors the former userUpdated / userProfileChanged
        // subscriptions, which had no handler).
        case UserSubtype.AccountUpdated:
        case UserSubtype.ProfileChanged:
          break;

        case UserSubtype.RemovedFromHome:
          handleRemovedFromHome(payload, client, selectedHomeId);
          break;

        case UserSubtype.AddedToHome:
          handleAddedToHome(client);
          break;

        case UserSubtype.RemovedFromShoppingList:
          handleRemovedFromShoppingList(payload, client);
          break;

        case UserSubtype.AddedToShoppingList:
          handleAddedToShoppingList();
          break;

        case UserSubtype.Banned:
        case UserSubtype.Suspended:
          handleBannedOrSuspended(payload, payload.subtype);
          break;

        case UserSubtype.Warned:
          toastService.error(
            payload.reason || t('accountEvents.warningReceived'),
          );
          break;

        case UserSubtype.Unbanned:
        case UserSubtype.Unsuspended:
          break;
      }
    },
  });

  const userSkip = !userId;
  const userEvents = useSubscription(UserEventsDocument, {
    variables: { userId: userId! },
    skip: userSkip,
    ...userEventHandlers,
  });
  useSubscriptionTransportRecovery('UserEvents', userEvents, userSkip);
}
