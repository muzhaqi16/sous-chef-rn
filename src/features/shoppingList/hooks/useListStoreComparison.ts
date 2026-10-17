import { skipToken, useQuery } from '@apollo/client/react';
import { PriceComparisonScope } from '#/graphql/generated/schemaTypes';
import {
  ListStoreComparisonDocument,
  type ListStoreComparisonQuery,
} from './useListStoreComparison.generated';

type Comparison = ListStoreComparisonQuery['shoppingListStoreComparison'];
type Candidate = Comparison['candidates'][number];

/** A candidate as the section shows it: the branch, or the chain when chains are compared. */
export type StoreComparisonCandidate = Pick<
  Candidate,
  | 'estimatedTotal'
  | 'pricedLines'
  | 'chainFilledLines'
  | 'anyStoreFilledLines'
  | 'ranked'
  | 'isTarget'
  | 'newestObservedAt'
> & {
  key: string;
  name: string;
  address: string | null;
  /** The chain a branch fills its gaps from; null when chains are compared. */
  chainName: string | null;
};

export type StoreComparison = Pick<
  Comparison,
  'comparableLines' | 'leftOutLines' | 'truncated'
> & {
  currencyCode: string;
  decimalPlaces: number;
  unpricedLines: number;
  candidates: StoreComparisonCandidate[];
};

function toCandidate({
  scope,
  store,
  chain,
  ...asAnswered
}: Candidate): StoreComparisonCandidate | null {
  const branch = scope === PriceComparisonScope.Store;
  const named = branch ? store : chain;
  if (!named) return null;
  return {
    ...asAnswered,
    key: named.id,
    name: named.name,
    address: branch ? store?.address ?? null : null,
    chainName: branch ? chain?.name ?? null : null,
  };
}

function toComparison(comparison: Comparison): StoreComparison {
  return {
    currencyCode: comparison.currency.code,
    decimalPlaces: comparison.currency.decimalPlaces,
    comparableLines: comparison.comparableLines,
    leftOutLines: comparison.leftOutLines,
    unpricedLines: comparison.unpricedLines.length,
    truncated: comparison.truncated,
    candidates: comparison.candidates.flatMap(candidate => {
      const view = toCandidate(candidate);
      return view ? [view] : [];
    }),
  };
}

/** Where a list is cheapest, by branch or by chain; null until answered. */
export function useListStoreComparison(
  listId: string | undefined,
  scope: PriceComparisonScope,
) {
  const { data, loading, error } = useQuery(
    ListStoreComparisonDocument,
    listId
      ? {
          variables: { input: { listId, scope } },
          // Prices move as items are ticked: each open asks again.
          fetchPolicy: 'cache-and-network',
          // A preview: the resync would spend the 30-a-minute budget.
          refetchOn: false,
        }
      : skipToken,
  );
  const answer = data?.shoppingListStoreComparison;
  return {
    comparison: answer ? toComparison(answer) : null,
    loading: loading && !answer,
    failed: !!error && !answer,
  };
}
