import { useEffect, useState } from 'react';
import { skipToken, useApolloClient, useQuery } from '@apollo/client/react';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { fetchPage } from '#hooks/utils/fetchPage';
import { useUserId } from '#store/useAppStore';
import { formatShortDate } from '#utils/formatters/date';
import { formatQuantityWithUnit } from '#utils/formatQuantity';
import { useReceiptDraft } from '../store/receiptDraftStore';
import {
  EarlierPurchasesOfItemDocument,
  type EarlierPurchasesOfItemQuery,
} from './useEarlierPurchases.generated';

/** A purchase a receipt line can be the receipt for, as the sheet offers it. */
export interface EarlierPurchase {
  id: string;
  version: number;
  /** What was bought, "12 pc". */
  amount: string;
  /** The day it was bought, as the device shows a short date. */
  boughtOn: string;
}

/** The purchases offered, and whether they could be read in full. */
export interface EarlierPurchases {
  /** Empty until every page is read: a partial list could hide the one. */
  purchases: EarlierPurchase[];
  state: DataState;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// A receipt is attached to a purchase made around its own day, not long before.
const WINDOW_DAYS = 14;

/**
 * The user's own purchases of `itemId` in this household in the days before
 * the receipt's, newest first: any the API lets a receipt fill. Only the buyer
 * attaches a receipt, so another member's are never offered; none is ever
 * picked for the user.
 */
export function useEarlierPurchases(itemId: string | null): EarlierPurchases {
  const client = useApolloClient();
  const { currentHome } = useCurrentPantry();
  const userId = useUserId();
  const receiptDay = useReceiptDraft()?.purchasedOn;
  const homeId = currentHome?.id;
  const end = receiptDay ? new Date(`${receiptDay}T23:59:59`).getTime() : null;
  const start = end === null ? null : end - WINDOW_DAYS * DAY_MS;
  const variables =
    homeId && itemId && start !== null && end !== null
      ? {
          homeId,
          itemId,
          fromDate: new Date(start).toISOString(),
          toDate: new Date(end).toISOString(),
        }
      : null;
  // Keyed by its filters, so it shares no entry with another read; a lookup
  // for one sheet, so a resync never re-asks it.
  const purchases = useQuery(
    EarlierPurchasesOfItemDocument,
    variables
      ? { variables, fetchPolicy: 'cache-first', refetchOn: false }
      : skipToken,
  );
  useApolloErrorLogger(EarlierPurchasesOfItemDocument, purchases.error);
  // `skipToken` keeps the last run's data: an item or home since changed, or
  // a line now naming none, never offers another's purchases.
  const answered =
    variables &&
    purchases.variables.itemId === variables.itemId &&
    purchases.variables.homeId === variables.homeId &&
    purchases.variables.fromDate === variables.fromDate
      ? purchases.data
      : undefined;
  const connection = answered?.home?.purchasesConnection;
  const hasNextPage = connection?.pageInfo.hasNextPage ?? false;
  const endCursor = connection?.pageInfo.endCursor ?? null;

  // Every page: the API cannot yet filter by buyer, so the user's own may sit
  // past the first. A page that failed is not asked again for this cursor.
  const [pageFailure, setPageFailure] = useState<{
    cursor: string;
    error: unknown;
  } | null>(null);
  const failedHere = pageFailure !== null && pageFailure.cursor === endCursor;
  const { observable } = purchases;
  useEffect(() => {
    if (!hasNextPage || !endCursor || failedHere) return;
    fetchPage(client, observable, { after: endCursor }).catch(
      (error: unknown) => {
        setPageFailure({ cursor: endCursor, error });
      },
    );
  }, [client, observable, hasNextPage, endCursor, failedHere]);

  const own = ownPurchases(connection, userId, start, end);
  const state = useDataState({
    loading: purchases.loading || (hasNextPage && !failedHere),
    error: purchases.error ?? (failedHere ? pageFailure.error : undefined),
    hasResult: connection !== undefined && !hasNextPage,
    isEmpty: own.length === 0,
    skipped: variables === null,
  });
  return { purchases: state === 'ready' ? own : [], state };
}

type Connection = NonNullable<
  NonNullable<EarlierPurchasesOfItemQuery['home']>['purchasesConnection']
>;

function ownPurchases(
  connection: Connection | undefined,
  userId: string | null | undefined,
  start: number | null,
  end: number | null,
): EarlierPurchase[] {
  if (!connection || !userId || start === null || end === null) return [];
  return connection.edges
    .map(({ node }) => node)
    .filter(purchase => {
      const at = new Date(purchase.purchaseDate).getTime();
      return purchase.purchasedBy?.id === userId && at >= start && at <= end;
    })
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    .map(purchase => ({
      id: purchase.id,
      version: purchase.version,
      amount: formatQuantityWithUnit(purchase.quantity, {
        symbol: purchase.unitSymbol,
      }),
      boughtOn: formatShortDate(new Date(purchase.purchaseDate)),
    }));
}
