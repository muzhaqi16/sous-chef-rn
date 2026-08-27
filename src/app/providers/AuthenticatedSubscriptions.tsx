import React from 'react';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { useHomeSubscriptions } from '#features/home/hooks/useHomeSubscriptions';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';

import { useUserSubscriptions } from '#/hooks/subscriptions/useUserSubscriptions';
import { useListAnimationOptional } from '#/context/ListAnimationContext';

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
export const AuthenticatedSubscriptions: React.FC<
  AuthenticatedSubscriptionsProps
> = ({ userId }) => {
  // Get animation scheduler from context (if available)
  // This allows subscription updates to trigger exit animations before cache updates
  // and entry animations when items appear in destination lists
  const animationContext = useListAnimationOptional();

  // Initialize domain-specific subscriptions
  // These hooks register their subscriptions with the SubscriptionService
  // and automatically handle cleanup when unmounted or when dependencies change
  useShoppingListSubscriptions(
    userId,
    animationContext?.scheduleAnimation,
    animationContext?.scheduleEntryAnimation,
  );
  usePantrySubscriptions(userId);
  useHomeSubscriptions(userId);
  useMealPlanSubscriptions(userId);

  useUserSubscriptions(userId);

  // This component doesn't render anything - it just runs subscription hooks
  return null;
};
