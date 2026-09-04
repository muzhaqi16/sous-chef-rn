/**
 * `ShoppingListItem.purchaseInfo` carries its clear-on-flip rule in a merge
 * policy, which `cache.modify` does not run — so the restoration pass writes it
 * through `writePurchaseInfo` rather than merging the persisted value blind.
 */
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import type { FieldWriterTable } from '#/apollo/utils/fieldWriters';

export const SHOPPING_LIST_FIELD_WRITERS: FieldWriterTable = {
  'ShoppingListItem.purchaseInfo': (cache, entityId, value) => {
    if (typeof value !== 'object' || value === null) return;
    const patch = value as {
      isPurchased?: unknown;
      movedToPantryAt?: unknown;
    };
    writePurchaseInfo(cache, entityId, {
      ...(typeof patch.isPurchased === 'boolean'
        ? { isPurchased: patch.isPurchased }
        : {}),
      ...(typeof patch.movedToPantryAt === 'string' ||
      patch.movedToPantryAt === null
        ? { movedToPantryAt: patch.movedToPantryAt }
        : {}),
    });
  },
};
