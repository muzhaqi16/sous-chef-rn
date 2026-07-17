/**
 * Home/Membership Subscriptions
 *
 * Centralizes home + membership real-time updates using the unified
 * SubscriptionService. Opens a single consolidated `homeEvents(homeId)` stream
 * carrying both membership changes (MEMBERSHIP_*) and invite lifecycle
 * (INVITE_*), discriminated by `subtype` — replacing the former
 * membershipChanged + homeInviteChanged subscriptions. One stream keeps the
 * per-user concurrent-subscription count low (the server caps it cluster-wide).
 *
 * Handles:
 * - Membership changes (join/leave, role/permission updates) — Apollo
 *   auto-normalizes the Membership entity by id.
 * - Invite lifecycle (created/accepted/declined/revoked) — maintains
 *   me.pendingHomeInvitesConnection.
 */

import { useIsHomeSelectionReady, useSelectedHomeId } from '#store/useAppStore';
import { useSubscription } from '@apollo/client/react';
import {
  HomeEventsDocument,
  type HomeEventsSubscription,
} from '#operations/home/home.generated';
import { HomeSubtype } from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { logger } from '#/utils/environment';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

type HomeEventsPayload = HomeEventsSubscription['homeEvents'];

// Invite connection updaters — module scope (constant config, no closure deps).
const addInviteToCache = createAddToParentConnectionUpdater<{ id: string }>(
  'User',
  'pendingHomeInvitesConnection',
  'HomeInvite',
);
const removeInviteFromCache = createRemoveFromParentConnectionUpdater(
  'User',
  'pendingHomeInvitesConnection',
  'HomeInvite',
);

/**
 * Initialize home/membership subscriptions for the current user.
 *
 * Subscribes to `homeEvents` for the user's selected home. Mounted once at the
 * app level (in AuthenticatedSubscriptions).
 *
 * @param userId - Current user ID for deduplication / self-echo suppression
 */
export function useHomeSubscriptions(userId?: string) {
  const selectedHomeId = useSelectedHomeId() || undefined;
  const isHomeSelectionReady = useIsHomeSelectionReady();

  const homeEventHandlers = subscriptionService.register<HomeEventsPayload>({
    subscriptionName: 'HomeEvents',
    entityType: 'Home',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedHomeId,
    customOnData: (
      payload: HomeEventsPayload,
      client: SubscriptionApolloClient,
    ) => {
      if (!payload) return;

      // Skip self-echo — local mutations already updated the cache.
      if (payload.actorUserId && userId && payload.actorUserId === userId) {
        if (__DEV__) {
          logger.debug('⏭️ [HomeEvents] Skipping self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        // Membership changes: Apollo auto-normalizes the Membership entity by
        // id (role/permission/status merge automatically). Join/leave
        // connection membership self-corrects via cache-and-network on next read.
        case HomeSubtype.MembershipJoined:
        case HomeSubtype.MembershipLeft:
        case HomeSubtype.MembershipUpdated:
        case HomeSubtype.MembershipRoleChanged:
          break;

        // New invite sent → add to me.pendingHomeInvitesConnection.
        case HomeSubtype.InviteCreated:
          if (userId && payload.node.__typename === 'HomeInvite') {
            addInviteToCache(client.cache, userId, payload.node);
          }
          break;

        // Invite accepted/declined/revoked → remove from
        // me.pendingHomeInvitesConnection and evict the entity.
        case HomeSubtype.InviteAccepted:
        case HomeSubtype.InviteDeclined:
        case HomeSubtype.InviteRevoked:
          if (userId && payload.node.__typename === 'HomeInvite') {
            removeInviteFromCache(client.cache, userId, payload.node.id, {
              evictItem: true,
            });
          }
          break;

        default:
          break;
      }
    },
  });

  useSubscription(HomeEventsDocument, {
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId || !isHomeSelectionReady,
    ...homeEventHandlers,
  });
}
