/**
 * User Subscriptions
 *
 * Centralizes user-related subscriptions using the unified SubscriptionService.
 * Handles real-time updates for:
 * - Profile changes (name, avatar, bio, etc.)
 * - Account updates (email, timezone, preferences)
 *
 * Apollo auto-normalizes both User and UserProfile entities by id,
 * so no manual cache updates are needed.
 */

import { useSubscription } from '@apollo/client/react';
import { UserChangesDocument } from '../../graphql/operations/auth/user.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';

/**
 * Initialize user subscriptions for multi-device profile/settings sync
 *
 * This hook should be called once at the app level (in AuthenticatedSubscriptions).
 * Apollo auto-normalizes the User and UserProfile entities returned by the
 * subscription, so changes from other devices are reflected automatically.
 *
 * @param userId - Current user ID for deduplication and subscription scoping
 */
export function useUserSubscriptions(userId?: string) {
  //
  // User Changes Subscription
  // Handles: PROFILE_CHANGED, UPDATED, ACTIVITY, STATUS_CHANGED, MODERATION_CHANGED
  // Apollo auto-normalizes User and UserProfile by id — no manual cache updates needed.
  //
  const userHandlers = subscriptionService.register({
    subscriptionName: 'UserChanges',
    entityType: 'User',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useSubscription(UserChangesDocument, {
    variables: { userId },
    skip: !userId,
    ...userHandlers,
  });
}
