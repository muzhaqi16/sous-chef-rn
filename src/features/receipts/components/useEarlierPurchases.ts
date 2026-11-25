import { skipToken, useQuery } from '@apollo/client/react';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useUserId } from '#store/useAppStore';
import { formatShortDate } from '#utils/formatters/date';
import { formatQuantityWithUnit } from '#utils/formatQuantity';
import { useReceiptDraft } from '../store/receiptDraftStore';
import { EarlierPurchasesOfItemDocument } from './useEarlierPurchases.generated';

/** A purchase a receipt line can be the receipt for, as the sheet offers it. */
export interface EarlierPurchase {
  id: string;
  version: number;
  /** What was bought, "12 pc". */
  amount: string;
  /** The day it was bought, as the device shows a short date. */
  boughtOn: string;
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
export function useEarlierPurchases(itemId: string | null): EarlierPurchase[] {
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
  // A lookup for one sheet: its filtered read stays out of the home's lists.
  const purchases = useQuery(
    EarlierPurchasesOfItemDocument,
    variables
      ? { variables, fetchPolicy: 'no-cache', refetchOn: false }
      : skipToken,
  );
  // A failed read offers no earlier purchase, so the line stays a new one.
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
  if (!userId || start === null || end === null) return [];
  return (answered?.home?.purchasesConnection.edges ?? [])
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
