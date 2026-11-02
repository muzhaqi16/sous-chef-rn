import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
import { isRecord } from '#/utils/isRecord';
import type { WriteRestatedBatches_PageFragment } from './restatedStack.generated';

/**
 * A stack's batches as a write's payload restates them, over the detail's
 * GetPantryItemBatches page. A first page replaces the window it covers.
 */
export function writeRestatedBatches(
  cache: ApolloCache,
  pantryItemId: string,
  page: Unmasked<WriteRestatedBatches_PageFragment>,
): void {
  cache.writeQuery({
    query: GetPantryItemBatchesDocument,
    variables: { pantryItemId },
    data: { __typename: 'Query', pantryItemBatchesConnection: page },
  });
}

/** An answer's `batchesConnection`, which a commit reads as `unknown`. */
export const isBatchesPage = (
  page: unknown,
): page is Unmasked<WriteRestatedBatches_PageFragment> =>
  isRecord(page) && Array.isArray(page.edges);

/** A new batch is the server's to build, so the screen reads the page again. */
export function dropBatchesPage(
  cache: ApolloCache,
  pantryItemId: string,
): void {
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'pantryItemBatchesConnection',
    args: { pantryItemId },
  });
}
