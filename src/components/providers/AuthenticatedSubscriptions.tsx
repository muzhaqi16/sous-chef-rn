import React from 'react';
import {
  useShoppingListSubscriptions,
  usePantrySubscriptions,
  useHomeSubscriptions,
  useNotificationSubscriptions,
} from '#/hooks/subscriptions';

interface AuthenticatedSubscriptionsProps {
  userId: string;
}

/**
 * AuthenticatedSubscriptions - Initializes all subscription hooks for authenticated users
 *
 * This component is only rendered when a user is authenticated, preventing
 * WebSocket connection attempts before authentication (which would fail with JWT errors).
 *
 * Architecture:
 * - Only mounts when user is logged in (controlled by SubscriptionProvider)
 * - Initializes all domain-specific subscription hooks
 * - Automatically unmounts on logout (via parent conditional rendering)
 * - Prevents "JWT token is required for WebSocket connections" errors on startup
 *
 * @param userId - The authenticated user's ID (required)
 */
export const AuthenticatedSubscriptions: React.FC<AuthenticatedSubscriptionsProps> = ({
  userId,
}) => {
  // Initialize domain-specific subscriptions
  // These hooks register their subscriptions with the SubscriptionService
  // and automatically handle cleanup when unmounted or when dependencies change
  useShoppingListSubscriptions(userId);
  usePantrySubscriptions(userId);
  useHomeSubscriptions(userId);
  useNotificationSubscriptions(userId);

  // This component doesn't render anything - it just runs subscription hooks
  return null;
};
