import { useEffect, useState } from 'react';
import { useFragment, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { logger } from '#/utils/environment';
import { formatCurrency } from '#/utils/formatters/number';
import {
  ListCostToGoDocument,
  UseListCostToGo_ListFragmentDoc,
  type UseListCostToGo_ListFragment,
} from './useListCostToGo.generated';

/** How long the unbought lines stay unchanged before the cost is asked again. */
const REPRICE_QUIET_MS = 1500;

/**
 * What a list's unbought lines will cost: each one's estimate, else its
 * suggestion. `amount` is null when no unbought line has a price.
 */
export type ListCostToGo = Omit<
  UseListCostToGo_ListFragment['costToGo'],
  '__typename'
>;

/** The list's cost to go as the device last read it; null until it has. */
export function useListCostToGo(
  listId: string | null | undefined,
): ListCostToGo | null {
  const read = useFragment({
    fragment: UseListCostToGo_ListFragmentDoc,
    fragmentName: 'useListCostToGo_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  return read.complete ? read.data.costToGo : null;
}

/**
 * Store mode's cost to go, read on its own and asked again once the unbought
 * lines (`linesKey`) stop changing, so a run of check-offs costs one read.
 * Offline it asks nothing: the resync when the API is back catches it up.
 */
export function useLiveCostToGo(
  listId: string,
  linesKey: string,
): ListCostToGo | null {
  const offline = useIsApiUnavailable();
  const { refetch, error } = useQuery(ListCostToGoDocument, {
    variables: { id: listId },
  });
  useApolloErrorLogger(ListCostToGoDocument, error);

  const [seen, setSeen] = useState(linesKey);
  const [changes, setChanges] = useState(0);
  const [asked, setAsked] = useState(0);
  if (linesKey !== seen) {
    setSeen(linesKey);
    // The first lines loaded are the ones the read just priced.
    if (seen !== '') setChanges(changes + 1);
  }
  if (offline && asked !== changes) setAsked(changes);

  useEffect(() => {
    if (offline || asked === changes) return;
    const timer = setTimeout(() => {
      setAsked(changes);
      refetch().catch((reason: unknown) =>
        logger.warn('Re-reading the cost to go failed', reason),
      );
    }, REPRICE_QUIET_MS);
    return () => clearTimeout(timer);
  }, [offline, asked, changes, refetch]);

  return useListCostToGo(listId);
}

/** The cost to go as money, or null when nothing is priced. */
export const formatCostToGo = (cost: ListCostToGo): string | null =>
  cost.amount == null ? null : formatCurrency(cost.amount, cost.currency);
