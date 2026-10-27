import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
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
