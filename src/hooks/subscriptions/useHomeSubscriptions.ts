/**
 * Home/Membership Subscriptions
 *
 * Centralizes all home and membership-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Membership changes (role updates, permissions)
 * - Member join/leave events
 * - Home metadata updates
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useAppStore } from '#store/useAppStore';
import {
  useMembershipChangesSubscription,
  useHomeInviteChangedSubscription,
  HomeInviteMutationType,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';

/**
 * Initialize home/membership subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant membership changes for the
 * user's selected home.
 *
 * @param userId - Current user ID for deduplication
 */
export function useHomeSubscriptions(userId?: string) {
  // Get selected home from global store
  const selectedHomeId = useAppStore(state => state.selectedHomeId) || undefined;
  const isHomeSelectionReady = useAppStore(state => state.isHomeSelectionReady);

  //
  // Membership Changes Subscription (consolidated)
  // Handles all membership events: JOINED, LEFT, UPDATED, ROLE_CHANGED
  // Uses customOnData to branch on changeType for cache strategy
  //
  const membershipHandlers = subscriptionService.register({
    subscriptionName: 'MembershipChanges',
    entityType: 'Membership',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedHomeId,
    customOnData: (payload: any, _client: any) => {
      if (!payload) return;

      const changeType = payload.changeType;

      switch (changeType) {
        case 'JOINED':
        case 'LEFT':
          // Manual cache updates for join/leave events
          // These require adding/removing from the memberships connection
          break;
        case 'UPDATED':
        case 'ROLE_CHANGED':
          // Automatic cache updates for role/permission changes
          // Apollo auto-normalizes these since the entity already exists
          break;
        default:
          break;
      }
    },
  });

  useMembershipChangesSubscription({
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId || !isHomeSelectionReady,
    ...membershipHandlers,
  });

  //
  // Home Invite Changed Subscription
  // Handles invite lifecycle: CREATED, ACCEPTED, DECLINED, REVOKED
  // Updates the me.pendingHomeInvites array in cache
  //
  const addInviteToCache = createAddToParentArrayUpdater<{ id: string }>('User', 'pendingHomeInvites');
  const removeInviteFromCache = createRemoveFromParentArrayUpdater('User', 'pendingHomeInvites', 'HomeInvite');

  const inviteHandlers = subscriptionService.register({
    subscriptionName: 'HomeInviteChanged',
    entityType: 'HomeInvite',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
    entityId: selectedHomeId,
    customOnData: (payload: any, client: any) => {
      if (!payload) return;

      // Skip self-echo
      if (payload.userId && userId && payload.userId === userId) {
        if (__DEV__) {
          console.log('⏭️ [HomeInviteChanged] Skipping self-echo');
        }
        return;
      }

      const mutation = payload.mutation;
      const invite = payload.homeInvite;

      if (!invite?.id) return;

      switch (mutation) {
        case HomeInviteMutationType.Created: {
          // Add new invite to me.pendingHomeInvites
          if (userId) {
            addInviteToCache(client.cache, userId, invite);
          }
          break;
        }
        case HomeInviteMutationType.Accepted:
        case HomeInviteMutationType.Declined:
        case HomeInviteMutationType.Revoked: {
          // Remove from me.pendingHomeInvites and evict entity
          if (userId) {
            removeInviteFromCache(client.cache, userId, invite.id, { evictItem: true });
          }
          break;
        }
        default:
          break;
      }
    },
  });

  useHomeInviteChangedSubscription({
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId || !isHomeSelectionReady,
    ...inviteHandlers,
  });
}
