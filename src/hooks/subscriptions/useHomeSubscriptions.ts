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

import { useStore } from '#store';
import {
  useMembershipUpdatedSubscription,
  useMemberJoinedSubscription,
  useMemberLeftSubscription,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
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
  const selectedHomeId = useStore(state => state.selectedHomeId) || undefined;

  //
  // Membership Updated Subscription
  // Handles changes to any membership in the selected home
  // (role changes, permission updates, etc.)
  //
  const membershipHandlers = subscriptionService.register({
    subscriptionName: 'MembershipUpdated',
    entityType: 'Membership',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
    enableLogging: true,
    entityId: selectedHomeId,
  });

  useMembershipUpdatedSubscription({
    variables: { homeId: selectedHomeId },
    skip: !selectedHomeId,
    ...membershipHandlers,
  });

  //
  // Member Joined Subscription
  // Real-time notification when new members join the home
  //
  const memberJoinedHandlers = subscriptionService.register({
    subscriptionName: 'MemberJoined',
    entityType: 'Membership',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.MANUAL,
    cacheFieldName: 'memberships', // Add new member to memberships array
    enableLogging: true,
    entityId: selectedHomeId,
  });

  useMemberJoinedSubscription({
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId,
    ...memberJoinedHandlers,
  });

  //
  // Member Left Subscription
  // Real-time notification when members leave the home
  //
  const memberLeftHandlers = subscriptionService.register({
    subscriptionName: 'MemberLeft',
    entityType: 'Membership',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.MANUAL,
    cacheFieldName: 'memberships', // Remove member from memberships array
    enableLogging: true,
    entityId: selectedHomeId,
  });

  useMemberLeftSubscription({
    variables: { homeId: selectedHomeId! },
    skip: !selectedHomeId,
    ...memberLeftHandlers,
  });

  // Additional home subscriptions can be added here:
  // - MembershipRoleChanged
  // - HomeUpdated
  // - etc.
}
