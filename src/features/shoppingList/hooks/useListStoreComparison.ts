import { skipToken, useQuery } from '@apollo/client/react';
import { PriceComparisonScope } from '#/graphql/generated/schemaTypes';
import {
  ListStoreComparisonDocument,
  type ListStoreComparisonQuery,
} from './useListStoreComparison.generated';

type Comparison = ListStoreComparisonQuery['shoppingListStoreComparison'];
type Candidate = Comparison['candidates'][number];

export interface StoreComparisonCandidate {
  key: string;
  /** The branch, or the chain when chains are compared. */
  name: string;
  address: string | null;
  /** The chain a branch fills its gaps from; null when chains are compared. */
  chainName: string | null;
  /** Null when no comparable line has a price anywhere. */
  estimatedTotal: number | null;
  pricedLines: number;
  chainFilledLines: number;
  anyStoreFilledLines: number;
  /** Prices at least half the comparable lines itself, so its total compares. */
  ranked: boolean;
  /** The list's own store, or its chain. */
  isTarget: boolean;
  newestObservedAt: string | null;
}

export interface StoreComparison {
  currencyCode: string;
  decimalPlaces: number;
  comparableLines: number;
  leftOutLines: number;
  unpricedLines: number;
  truncated: boolean;
  candidates: StoreComparisonCandidate[];
}

function toCandidate(candidate: Candidate): StoreComparisonCandidate | null {
  const branch = candidate.scope === PriceComparisonScope.Store;
  const named = branch ? candidate.store : candidate.chain;
  if (!named) return null;
  return {
    key: named.id,
    name: named.name,
    address: branch ? candidate.store?.address ?? null : null,
    chainName: branch ? candidate.chain?.name ?? null : null,
    estimatedTotal: candidate.estimatedTotal,
    pricedLines: candidate.pricedLines,
    chainFilledLines: candidate.chainFilledLines,
    anyStoreFilledLines: candidate.anyStoreFilledLines,
    ranked: candidate.ranked,
    isTarget: candidate.isTarget,
    newestObservedAt: candidate.newestObservedAt,
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
