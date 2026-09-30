/**
 * One `homeEvents(homeId)` stream carries both membership and invite changes,
 * discriminated by `subtype` — a single stream keeps the per-user subscription
 * count under the server's cap. The event carries only the envelope plus the
 * changed id: subscriptions validate at depth 5, which no fragment spread fits.
 */

import { useSelectedHomeId } from '#store/useAppStore';
import type { ApolloCache } from '@apollo/client';
import { useSubscription } from '@apollo/client/react';
import {
  GetHomeDocument,
  GetHomesDocument,
  GetMyPendingInvitesDocument,
  HomeEventsDocument,
  type HomeEventsSubscription,
} from '#operations/home/home.generated';
import { HomeSubtype } from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { fetchEventEntity } from '#/services/subscriptions/fetchEventEntity';
import { isSelfEcho } from '#/services/subscriptions/isSelfEcho';
import {
  CacheStrategy,
  type SubscriptionApolloClient,
} from '#/services/subscriptions/types';
import { logger } from '#/utils/environment';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useSubscriptionTransportRecovery } from '#hooks/subscriptions/useSubscriptionTransportRecovery';
import { useEntitySubscriptionSkip } from '#hooks/subscriptions/useEntitySubscriptionSkip';
import {
  HomeInvitesForEventDocument,
  UseHomeSubscriptions_HomeFragmentDoc,
} from './useHomeSubscriptions.generated';

type HomeEventsPayload = HomeEventsSubscription['homeEvents'];

// Invite connection updater — module scope (constant config, no closure deps).
const removeInviteFromCache = createRemoveFromParentConnectionUpdater(
  'User',
  'pendingHomeInvitesConnection',
  'HomeInvite',
);

/**
 * Whether a membership event is about the viewer. Unknown when the home list
 * has not cached the viewer's row, which counts as yes: a missed refetch
 * leaves stale permissions, a spare one only costs a request.
 */
function concernsViewer(
  cache: ApolloCache,
  homeId: string,
  membershipId: string,
): boolean {
  const cacheId = cache.identify({ __typename: 'Home', id: homeId });
  const home =
    cacheId &&
    cache.readFragment({
      id: cacheId,
      fragment: UseHomeSubscriptions_HomeFragmentDoc,
    });
  const viewerMembershipId = home ? home.myMembership?.id : undefined;
  return !viewerMembershipId || viewerMembershipId === membershipId;
}

/**
 * Subscribes to `homeEvents` for the selected home. Mounted once at app level,
 * in `AuthenticatedSubscriptions`. `userId` drives self-echo suppression.
 */
export function useHomeSubscriptions(userId?: string) {
  const selectedHomeId = useSelectedHomeId() ?? undefined;
  const homeSkip = useEntitySubscriptionSkip(
    HomeEventsDocument,
    selectedHomeId,
  );

  const homeEventHandlers = subscriptionService.register<HomeEventsPayload>({
    document: HomeEventsDocument,
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
      // Skip this device's own echo — its mutation already updated the cache.
      // An admin acting on you reports the ADMIN, so the event that removed you
      // still gets through.
      if (isSelfEcho(payload, userId)) {
        if (__DEV__) {
          logger.debug('⏭️ [HomeEvents] Skipping self-echo');
        }
        return;
      }

      switch (payload.subtype) {
        // A membership change is a change to the member list, which no
        // single-entity read expresses — refetch the query that owns it, which
        // is watched only while a home screen is open. `GetHomes` stays mounted
        // all session and carries the `myMembership` flags the pantry's
        // permissions read, so it is refetched only for the viewer's own row:
        // an owner's grant or revoke lands live, and another member's change
        // does not refetch every home on every member's device.
        case HomeSubtype.MembershipJoined:
        case HomeSubtype.MembershipLeft:
        case HomeSubtype.MembershipUpdated:
        case HomeSubtype.MembershipRoleChanged:
          void client.refetchQueries({
            include: concernsViewer(
              client.cache,
              payload.homeId,
              payload.node.id,
            )
              ? [GetHomeDocument, GetHomesDocument]
              : [GetHomeDocument],
          });
          break;

        // New invite sent → refresh me.pendingHomeInvitesConnection and the
        // home's own invite list, which a co-admin's invite otherwise never
        // reaches. Adding the id alone would leave either read incomplete and
        // blank the list, so both are read back rather than written partial.
        case HomeSubtype.InviteCreated:
          void client.refetchQueries({
            include: [GetMyPendingInvitesDocument],
          });
          void fetchEventEntity(
            client,
            HomeInvitesForEventDocument,
            { id: payload.homeId },
            'HomeInvite',
          );
          break;

        // Invite accepted/declined/revoked → remove from
        // me.pendingHomeInvitesConnection and evict the entity. An `Invite*`
        // subtype is what names the node as the invite.
        case HomeSubtype.InviteAccepted:
        case HomeSubtype.InviteDeclined:
        case HomeSubtype.InviteRevoked:
          if (userId) {
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

  const homeEvents = useSubscription(HomeEventsDocument, {
    // `skip` holds while there is no home, so the empty id is never sent.
    variables: { homeId: selectedHomeId ?? '' },
    skip: homeSkip,
    // Same reason as `PantryEvents`: the envelope's `node` is `__typename` +
    // `id` only, so caching it writes a Membership/HomeInvite stripped of every
    // field a screen reads. A removal event would re-create the entity it just
    // announced was gone, leaving `GetHome` incomplete and forcing a refetch of
    // the whole page. Every handler here reads the entity back by query anyway.
    fetchPolicy: 'no-cache',
    ...homeEventHandlers,
  });
  useSubscriptionTransportRecovery(HomeEventsDocument, homeEvents, homeSkip);
}
