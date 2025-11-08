/**
 * Subscription Hooks Exports
 *
 * Domain-specific subscription hooks that use the unified SubscriptionService.
 * These hooks should be called once at the app level (in SubscriptionProvider)
 * to initialize real-time subscriptions for the current user.
 */

export { useShoppingListSubscriptions } from './useShoppingListSubscriptions';
export { usePantrySubscriptions } from './usePantrySubscriptions';
export { useHomeSubscriptions } from './useHomeSubscriptions';
export { useNotificationSubscriptions } from './useNotificationSubscriptions';
