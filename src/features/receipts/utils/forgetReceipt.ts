import type { ApolloCache } from '@apollo/client';
import { isRecord } from '#/utils/isRecord';
import { scheduleIdle } from '#/utils/scheduleIdle';

/**
 * Drops an ended receipt's parse, line lookups and by-item list lines, which
 * nothing else reads and the persisted cache would carry until sign-out. On
 * idle, so a screen still watching them lets go first and asks for none again.
 */
export function forgetReceipt(
  cache: ApolloCache,
  parseId: string | undefined,
): void {
  scheduleIdle(() => {
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
