import type { ApolloCache } from '@apollo/client';

/**
 * Drops an ended receipt's parse and line lookups, which nothing else reads and
 * the persisted cache would otherwise carry until sign-out. On idle, so a screen
 * still watching them has let go first and does not ask for them again.
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
    cache.gc();
  });
}
