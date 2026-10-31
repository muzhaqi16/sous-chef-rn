import type { ApolloClient, OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';

/** The list a page belongs to: `useQuery`'s `observable` satisfies it. */
export interface PagedQuery {
  query: DocumentNode;
  variables: OperationVariables;
}

/**
 * The next page of a list, read beside its watcher and merged by the list's
 * field policy. A `fetchMore` runs on the watcher, and Apollo delivers it no
 * cache change until that ends, so a tick would show only once the page landed.
 * A page is never answered from the list the cache already merged.
 */
export async function fetchPage(
  client: ApolloClient,
  { query, variables }: PagedQuery,
  page: OperationVariables,
) {
  const result = await client.query({
    query,
    variables: { ...variables, ...page },
    fetchPolicy: 'network-only',
    errorPolicy: 'none',
    context: { page: true },
  });
  // A watcher hears of a write on a zero timer, queued by now, so the list shows
  // the page before its caller asks for the next from the new cursor.
  await new Promise(resolve => setTimeout(resolve, 0));
  return result;
}
