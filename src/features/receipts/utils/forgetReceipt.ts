import type { ApolloCache } from '@apollo/client';
import { isRecord } from '#/utils/isRecord';

/**
 * Drops an ended receipt's parse, line lookups and the list lines it asked for
 * by item, which nothing else reads and the persisted cache would otherwise
 * carry until sign-out. On idle, so a screen still watching them has let go
 * first and does not ask for them again.
 */
export function forgetReceipt(
  cache: ApolloCache,
  parseId: string | undefined,
): void {
  requestIdleCallback(() => {
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'resolveReceiptLines' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'receiptParse' });
    if (parseId) {
      cache.evict({
        id: cache.identify({ __typename: 'ReceiptParse', id: parseId }),
      });
    }
    // Keyed apart from the list tab's own lines by their `itemIds` filter.
    const store = cache.extract();
    for (const id of isRecord(store) ? Object.keys(store) : []) {
      if (!id.startsWith('ShoppingList:')) continue;
      cache.modify({
        id,
        fields: {
          itemsConnection: (value: unknown, { storeFieldName, DELETE }) =>
            storeFieldName.includes('"itemIds"') ? DELETE : value,
        },
      });
    }
    cache.gc();
  });
}
