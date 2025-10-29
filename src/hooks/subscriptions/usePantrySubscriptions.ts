/**
 * Pantry Subscriptions
 *
 * Centralizes all pantry-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - Pantry items (add/update/delete)
 * - Pantry metadata (name, description)
 * - Low stock alerts
 * - Expiring items alerts
 *
 * These subscriptions automatically update the Apollo cache and provide
 * deduplication to prevent self-echo and duplicate updates.
 */

import { useStore } from '#store';
import {
  usePantryItemsChangedSubscription,
  usePantryUpdatedSubscription,
  usePantryLowStockAlertSubscription,
  usePantryExpiringItemsAlertSubscription,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
import { CacheStrategy } from '#/services/subscriptions/types';

/**
 * Initialize pantry subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It automatically subscribes to relevant pantry changes based on
 * the user's selected home and pantry.
 *
 * @param userId - Current user ID for deduplication
 */
export function usePantrySubscriptions(userId?: string) {
  // Get selected pantry from global store
  const selectedPantryId = useStore(state => state.selectedPantryId) || undefined;

  //
  // Pantry Items Changed Subscription
  // Handles CREATE/UPDATE/DELETE operations on pantry items
  //
  // NOTE: After GraphQL fix, this will receive full PantryItemFragment
  // Currently only receives minimal data (id, itemName, unit)
  //
  const itemsHandlers = subscriptionService.register({
    subscriptionName: 'PantryItemsChanged',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC, // Will work after GraphQL fragment fix
    cacheFieldName: 'pantryItems',
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryItemsChangedSubscription({
    variables: { pantryId: selectedPantryId || '' },
    skip: !selectedPantryId,
    ...itemsHandlers,
  });

  //
  // Pantry Updated Subscription
  // Handles metadata changes (name, description)
  //
  const metadataHandlers = subscriptionService.register({
    subscriptionName: 'PantryUpdated',
    entityType: 'Pantry',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryUpdatedSubscription({
    variables: { id: selectedPantryId || '' },
    skip: !selectedPantryId,
    ...metadataHandlers,
  });

  //
  // Pantry Low Stock Alert Subscription
  // Real-time alerts when items reach reorder point
  //
  const lowStockHandlers = subscriptionService.register({
    subscriptionName: 'PantryLowStockAlert',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Alerts don't need cache updates
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryLowStockAlertSubscription({
    variables: { pantryId: selectedPantryId || '' },
    skip: !selectedPantryId,
    ...lowStockHandlers,
  });

  //
  // Pantry Expiring Items Alert Subscription
  // Real-time alerts for items expiring soon
  //
  const expiringHandlers = subscriptionService.register({
    subscriptionName: 'PantryExpiringItemsAlert',
    entityType: 'PantryItem',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE, // Alerts don't need cache updates
    enableLogging: true,
    entityId: selectedPantryId,
  });

  usePantryExpiringItemsAlertSubscription({
    variables: { pantryId: selectedPantryId || '' },
    skip: !selectedPantryId,
    ...expiringHandlers,
  });

  // Additional pantry subscriptions can be added here:
  // - PantryItemUsageChanged
  // - PantryWasteAlert
  // - etc.
}
