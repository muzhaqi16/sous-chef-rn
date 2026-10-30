import { skipToken, useQuery } from '@apollo/client/react';
import {
  ListStoreSavingsDocument,
  type ListStoreSavingsQuery,
} from './useListStoreComparison.generated';

type Savings = ListStoreSavingsQuery['shoppingListStoreSavings'];
type Candidate = Savings['candidates'][number];

/** A candidate as the section shows it: a branch. */
export type StoreComparisonCandidate = Pick<Candidate, 'total' | 'isTarget'> & {
  key: string;
  name: string;
  address: string | null;
  /** Lines its shelf prices, the same product or a similar one. */
  pricedLines: number;
  /** Lines at a typical price, with no shelf price there. */
  estimatedLines: number;
};

export type StoreComparison = Pick<
  Savings,
  'comparableLines' | 'leftOutLines' | 'truncated'
> & {
  currencyCode: string;
  decimalPlaces: number;
  candidates: StoreComparisonCandidate[];
};

function toCandidate(candidate: Candidate): StoreComparisonCandidate | null {
  const { store } = candidate;
  if (!store) return null;
  return {
    key: store.id,
    name: store.name,
    address: store.address ?? null,
    total: candidate.total,
    isTarget: candidate.isTarget,
    pricedLines: candidate.sameLines + candidate.similarLines,
    estimatedLines: candidate.estimatedLines,
  };
}

function toComparison(savings: Savings): StoreComparison {
  return {
    currencyCode: savings.currency.code,
    decimalPlaces: savings.currency.decimalPlaces,
    comparableLines: savings.comparableLines,
    leftOutLines: savings.leftOutLines,
    truncated: savings.truncated,
    candidates: savings.candidates.flatMap(candidate => {
      const view = toCandidate(candidate);
      return view ? [view] : [];
    }),
  };
}

/** Where a list costs less, at the household's usual stores; null until answered. */
export function useListStoreComparison(listId: string | undefined) {
  const { data, loading, error } = useQuery(
    ListStoreSavingsDocument,
    listId
      ? {
          variables: { input: { listId } },
          // Prices move as items are ticked: each open asks again.
          fetchPolicy: 'cache-and-network',
          // A preview: the resync would spend the per-minute budget.
          refetchOn: false,
        }
      : skipToken,
  );
  const answer = data?.shoppingListStoreSavings;
  return {
    comparison: answer ? toComparison(answer) : null,
    loading: loading && !answer,
    failed: !!error && !answer,
  };
}
