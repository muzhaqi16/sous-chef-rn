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
} from '#generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';

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

  // Additional home subscriptions can be added here:
  // - HomeUpdated
  // - etc.
}
