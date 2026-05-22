/**
 * User Subscriptions
 *
 * Centralizes user-related subscriptions using the unified SubscriptionService.
 * Handles real-time updates for:
 * - Account updates (email, timezone, preferences) via userUpdated
 * - Profile changes (name, avatar, bio, etc.) via userProfileChanged
 *
 * Apollo auto-normalizes both User and UserProfile entities by id,
 * so no manual cache updates are needed.
 */

import { useSubscription } from '@apollo/client/react';
import {
  UserUpdatedDocument,
  UserProfileChangedDocument,
} from '#operations/auth/user.generated';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { CacheStrategy } from '#/services/subscriptions/types';

/**
 * Initialize user subscriptions for multi-device profile/settings sync
 *
 * Two subscriptions: one for account-level User updates, one for UserProfile
 * changes. Both rely on Apollo auto-normalization (CacheStrategy.NONE).
 *
 * @param userId - Current user ID for deduplication and subscription scoping
 */
export function useUserSubscriptions(userId?: string) {
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
}
