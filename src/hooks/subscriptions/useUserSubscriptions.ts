/**
 * User Subscriptions
 *
 * Centralizes user-related subscriptions using the unified SubscriptionService.
 * Handles real-time updates for:
 * - Account updates (email, timezone, preferences) via userUpdated
 * - Profile changes (name, avatar, bio, etc.) via userProfileChanged
 * - Lifecycle events (membership, moderation) via userLifecycleEvents
 */

import { useApolloClient, useSubscription } from '@apollo/client/react';
import {
  UserUpdatedDocument,
  UserProfileChangedDocument,
  UserLifecycleEventsDocument,
  type UserLifecycleEventsSubscription,
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
import { UserLifecycleEventSubtype } from '#/graphql/generated/schemaTypes';
import { useSelectedHomeId } from '#store/useAppStore';
import { useStore } from '#store/index';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { authService } from '#/services/authService';

type LifecyclePayload = UserLifecycleEventsSubscription['userLifecycleEvents'];

function handleRemovedFromHome(
  payload: LifecyclePayload,
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
  }

  toastService.error('You were removed from a home');
}

function handleAddedToHome(client: SubscriptionApolloClient) {
  client.refetchQueries({ include: [GetHomesDocument] });
  toastService.success('You were added to a new home');
}

function handleRemovedFromShoppingList(
  payload: LifecyclePayload,
  client: SubscriptionApolloClient,
) {
  const listId = payload.parents?.shoppingListId;
  if (!listId) return;

  safeEvict(client.cache, 'ShoppingList', listId);

  const store = useStore.getState();
  if (store.selectedShoppingListId === listId) {
    store.setSelectedShoppingListId(null);
  }

  toastService.error('You were removed from a shopping list');
}

function handleAddedToShoppingList() {
  toastService.success('You were added to a shopping list');
}

function handleBannedOrSuspended(
  payload: LifecyclePayload,
  subtype: UserLifecycleEventSubtype,
) {
  const label =
    subtype === UserLifecycleEventSubtype.Banned ? 'banned' : 'suspended';
  const reason = payload.reason ? `: ${payload.reason}` : '';
  toastService.error(`Your account has been ${label}${reason}`);
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

  const userHandlers = subscriptionService.register({
    subscriptionName: 'UserUpdated',
    entityType: 'User',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useSubscription(UserUpdatedDocument, {
    variables: { userId },
    skip: !userId,
    ...userHandlers,
  });

  const profileHandlers = subscriptionService.register({
    subscriptionName: 'UserProfileChanged',
    entityType: 'UserProfile',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useSubscription(UserProfileChangedDocument, {
    variables: { userId },
    skip: !userId,
    ...profileHandlers,
  });

  const lifecycleHandlers = subscriptionService.register<LifecyclePayload>({
    subscriptionName: 'UserLifecycleEvents',
    entityType: 'User',
    enableDeduplication: false,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    customOnData: (payload: LifecyclePayload) => {
      if (!payload) return;

      switch (payload.subtype) {
        case UserLifecycleEventSubtype.RemovedFromHome:
          handleRemovedFromHome(payload, client, selectedHomeId);
          break;

        case UserLifecycleEventSubtype.AddedToHome:
          handleAddedToHome(client);
          break;

        case UserLifecycleEventSubtype.RemovedFromShoppingList:
          handleRemovedFromShoppingList(payload, client);
          break;

        case UserLifecycleEventSubtype.AddedToShoppingList:
          handleAddedToShoppingList();
          break;

        case UserLifecycleEventSubtype.Banned:
        case UserLifecycleEventSubtype.Suspended:
          handleBannedOrSuspended(payload, payload.subtype);
          break;

        case UserLifecycleEventSubtype.Warned:
          toastService.error(
            payload.reason || 'You received a warning from a moderator',
          );
          break;

        case UserLifecycleEventSubtype.Unbanned:
        case UserLifecycleEventSubtype.Unsuspended:
          break;
      }
    },
  });

  useSubscription(UserLifecycleEventsDocument, {
    variables: { userId: userId! },
    skip: !userId,
    ...lifecycleHandlers,
  });
}
