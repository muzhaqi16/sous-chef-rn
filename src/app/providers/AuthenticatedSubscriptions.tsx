import React from 'react';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { useHomeSubscriptions } from '#features/home/hooks/useHomeSubscriptions';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';

import { useUserSubscriptions } from '#/hooks/subscriptions/useUserSubscriptions';
import { useQuietHoursTimezoneSync } from '#features/notifications/hooks/useQuietHoursTimezoneSync';
import { useListAnimationOptional } from '#/context/ListAnimationContext';

interface AuthenticatedSubscriptionsProps {
  userId: string;
}

/**
 * Mounts every domain subscription hook, and only while a user is
 * authenticated — the socket needs a JWT, so connecting earlier fails. The
 * parent's conditional render is what unmounts them on logout.
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

  // Not a subscription, but it needs the same app-wide authenticated mount: the
  // notification screens are the only other place it would run, and a user who
  // travels has no reason to open one.
  useQuietHoursTimezoneSync();

  // This component doesn't render anything - it just runs subscription hooks
  return null;
};
