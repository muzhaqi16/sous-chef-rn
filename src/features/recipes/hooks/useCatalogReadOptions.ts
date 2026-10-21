import { useState } from 'react';
import type { TypedDocumentNode } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { useApolloClient } from '@apollo/client/react';
import {
  catalogFetchedAt,
  catalogFetchKey,
  type CatalogField,
} from '#features/recipes/store/catalogFetchTimes';

type CatalogFetchPolicy = 'cache-first' | 'cache-and-network' | 'network-only';

interface CatalogReadOptions {
  fetchPolicy: CatalogFetchPolicy;
  refetchOn: false;
  /**
   * A refresh hands the field policy the page it holds to keep: Apollo's default
   * for `refetch()` overwrites, passing the merge no `existing`.
   */
  refetchWritePolicy: 'merge';
}

interface CatalogRead<TData> {
  field: CatalogField;
  /** How long a complete answer is served from the device. */
  maxAgeMs: number;
  /** Reads `readQuery`'s answer, which Apollo types unmasked. */
  pageOf: (data: Unmasked<TData>) => { catalogAvailable: boolean };
}

/**
 * The options a catalog read runs with. It declines resync, and its first fetch
 * policy asks again for a page held from when the catalog was down, unseen
 * (`network-only`), and shows one with no recorded arrival, or older than
 * `maxAgeMs`, while it asks again (`cache-and-network`). Decided once per
 * `variables` while mounted, so an answer that comes back degraded is not
 * asked for again.
 */
export function useCatalogReadOptions<
  TData,
  TVariables extends Record<string, unknown>,
>(
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables | null,
  { field, maxAgeMs, pageOf }: CatalogRead<TData>,
) {
  const client = useApolloClient();
  const key = variables === null ? null : JSON.stringify(variables);
  const policyOf = (): CatalogFetchPolicy => {
    if (variables === null) return 'cache-first';
    const held = client.readQuery({ query, variables });
    // Nothing held: `cache-first` asks the API anyway.
    if (!held) return 'cache-first';
    if (!pageOf(held).catalogAvailable) return 'network-only';
    const fetchedAt = catalogFetchedAt(catalogFetchKey(field, variables));
    return fetchedAt === undefined || Date.now() - fetchedAt > maxAgeMs
      ? 'cache-and-network'
      : 'cache-first';
  };
  const [chosen, setChosen] = useState(() => ({ key, policy: policyOf() }));
  let fetchPolicy = chosen.policy;
  if (chosen.key !== key) {
    fetchPolicy = policyOf();
    setChosen({ key, policy: fetchPolicy });
  }
  return {
    fetchPolicy,
    refetchOn: false,
    refetchWritePolicy: 'merge',
  } satisfies CatalogReadOptions;
}
