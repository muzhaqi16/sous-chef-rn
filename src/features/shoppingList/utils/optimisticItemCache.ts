import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

/**
 * Drop the persisted optimistic shopping items before a manual refresh, so the
 * server's answer is not merged on top of rows it has already reconciled.
 */
export function discardOptimisticShoppingItems() {
  optimisticDataPersistence.clearType('ShoppingListItem');
}
