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
 * - Membership changes (join/leave, role/permission updates) — refreshes the
 *   home's member list.
 * - Invite lifecycle (created/accepted/declined/revoked) — maintains
 *   me.pendingHomeInvitesConnection.
 *
 * The event carries the envelope plus the changed entity's id — subscriptions
 * are validated against depth 5, which no fragment spread fits under. Removals
 * work from the id alone; connection changes are refetched.
 */

import { useIsHomeSelectionReady, useSelectedHomeId } from '#store/useAppStore';
import { useSubscription } from '@apollo/client/react';
import {
  GetHomeDocument,
  GetMyPendingInvitesDocument,
  HomeEventsDocument,
  type HomeEventsSubscription,
} from '#operations/home/home.generated';
import { HomeSubtype } from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
import { useSubscriptionRejected } from '#/services/subscriptions/rejectedSubscriptions';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { logger } from '#/utils/environment';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useSubscriptionTransportRecovery } from './useSubscriptionTransportRecovery';

type HomeEventsPayload = HomeEventsSubscription['homeEvents'];

// Invite connection updater — module scope (constant config, no closure deps).
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
  const rejected = useSubscriptionRejected('HomeEvents');

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

      // Skip this device's own echo — its mutation already updated the cache.
      // An admin acting on you reports the admin, so this no longer swallows
      // the event that removed you.
      if (isSelfEcho(payload, userId)) {
        if (__DEV__) {
          logger.debug('⏭️ [HomeEvents] Skipping self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        // A membership change is a change to the member list, which no
        // single-entity read expresses — refetch the query that owns it.
        case HomeSubtype.MembershipJoined:
        case HomeSubtype.MembershipLeft:
        case HomeSubtype.MembershipUpdated:
        case HomeSubtype.MembershipRoleChanged:
          void client.refetchQueries({ include: [GetHomeDocument] });
          break;

        // New invite sent → refresh me.pendingHomeInvitesConnection. Adding the
        // id alone would leave the connection's read incomplete and blank the
        // list, so refetch rather than write a partial invite.
        case HomeSubtype.InviteCreated:
          void client.refetchQueries({
            include: [GetMyPendingInvitesDocument],
          });
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

  const homeSkip = !selectedHomeId || !isHomeSelectionReady || rejected;
  const homeEvents = useSubscription(HomeEventsDocument, {
    variables: { homeId: selectedHomeId! },
    skip: homeSkip,
    // Same reason as `PantryEvents`: the envelope's `node` is `__typename` +
    // `id` only, so caching it writes a Membership/HomeInvite stripped of every
    // field a screen reads. A removal event would re-create the entity it just
    // announced was gone, leaving `GetHome` incomplete and forcing a refetch of
    // the whole page. Every handler here reads the entity back by query anyway.
    fetchPolicy: 'no-cache',
    ...homeEventHandlers,
  });
  useSubscriptionTransportRecovery('HomeEvents', homeEvents, homeSkip);
}
