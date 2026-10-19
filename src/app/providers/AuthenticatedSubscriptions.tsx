import type React from 'react';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { useHomeSubscriptions } from '#features/home/hooks/useHomeSubscriptions';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';

import { useUserSubscriptions } from '#/hooks/subscriptions/useUserSubscriptions';
import { useDeviceTimezoneSync } from '#features/notifications/hooks/useDeviceTimezoneSync';
import { useAccountCurrencySync } from '#features/profile/hooks/useAccountCurrencySync';

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
  // Initialize domain-specific subscriptions
  // These hooks register their subscriptions with the SubscriptionService
  // and automatically handle cleanup when unmounted or when dependencies change
  useShoppingListSubscriptions(userId);
  usePantrySubscriptions(userId);
  useHomeSubscriptions(userId);
  useMealPlanSubscriptions(userId);

  useUserSubscriptions(userId);

  // Not subscriptions, but they need the same app-wide authenticated mount: a
  // traveller has no reason to open a settings screen, and a currency changed
  // on another device reaches this one only through the resync's re-read.
  useDeviceTimezoneSync();
  useAccountCurrencySync();

  // This component doesn't render anything - it just runs subscription hooks
  return null;
};
