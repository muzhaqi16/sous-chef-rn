import { skipToken, useQuery } from '@apollo/client/react';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useUserId } from '#store/useAppStore';
import { formatShortDate } from '#/utils/formatters/date';
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
import { useReceiptDraft } from '../store/receiptDraftStore';
import {
  EarlierPurchasesOfStackDocument,
  HeldStacksOfItemDocument,
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

const DAY_MS = 24 * 60 * 60 * 1000;
// A receipt is attached to a purchase made around its own day, not long before.
const WINDOW_DAYS = 14;

/**
 * The user's own purchases of `itemId` that stocked this pantry in the days
 * before the receipt's, newest first. Only the buyer attaches a receipt, so
 * another member's are never offered; none is ever picked for the user.
 */
export function useEarlierPurchases(itemId: string | null): EarlierPurchase[] {
  const { pantry } = useCurrentPantry();
  const userId = useUserId();
  const receiptDay = useReceiptDraft()?.purchasedOn;
  // A lookup for one sheet: its filtered read stays out of the pantry's lists.
  const stacks = useQuery(
    HeldStacksOfItemDocument,
    pantry && itemId
      ? {
          variables: { pantryId: pantry.id, itemId },
          fetchPolicy: 'no-cache',
          refetchOn: false,
        }
      : skipToken,
  );
  // A failed read offers no earlier purchase, so the line stays a new one.
  useApolloErrorLogger(HeldStacksOfItemDocument, stacks.error);
  // `skipToken` keeps the last run's data: an item since changed or cleared,
  // or one this pantry holds no stack of, never offers another's purchases.
  const stacksData =
    pantry &&
    itemId &&
    stacks.variables.itemId === itemId &&
    stacks.variables.pantryId === pantry.id
      ? stacks.data
      : undefined;
  const [stack] = stacksData?.pantry?.itemsConnection.edges ?? [];
  const batches = useQuery(
    EarlierPurchasesOfStackDocument,
    stack
      ? {
          variables: { pantryItemId: stack.node.id },
          fetchPolicy: 'no-cache',
          refetchOn: false,
        }
      : skipToken,
  );
  useApolloErrorLogger(EarlierPurchasesOfStackDocument, batches.error);
  const batchesData =
    stack && batches.variables.pantryItemId === stack.node.id
      ? batches.data
      : undefined;
  if (!userId || !receiptDay) return [];
  const end = new Date(`${receiptDay}T23:59:59`).getTime();
  const start = end - WINDOW_DAYS * DAY_MS;
  return (batchesData?.pantryItemBatchesConnection.edges ?? [])
    .flatMap(({ node }) => (node.purchase ? [node.purchase] : []))
    .filter(purchase => {
      const at = new Date(purchase.purchaseDate).getTime();
      return purchase.purchasedBy?.id === userId && at >= start && at <= end;
    })
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    .filter(
      (purchase, at, all) => all.findIndex(p => p.id === purchase.id) === at,
    )
    .map(purchase => ({
      id: purchase.id,
      version: purchase.version,
      amount: formatQuantityWithUnit(purchase.quantity, {
        symbol: purchase.unitSymbol,
      }),
      boughtOn: formatShortDate(new Date(purchase.purchaseDate)),
    }));
}
