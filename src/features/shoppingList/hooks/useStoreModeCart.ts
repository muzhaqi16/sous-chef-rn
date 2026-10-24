import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import {
  matchScannedLine,
  type ScannedProductRef,
} from '#features/shoppingList/utils/matchScannedLine';
import { useToggleShoppingItem } from './mutations/useToggleShoppingItem';
import { unitPriceFromTotal } from '#features/shoppingList/utils/purchasePrice';
import type { PurchaseAmountItem } from './usePurchaseAmountModal';

/**
 * Store mode's cart for a scanned product: the list line it fulfils and how to
 * tick it. The lines come from what store mode already holds, so a shelf with
 * no signal still matches.
 */
export function useStoreModeCart(
  listId: string | undefined,
  scanned: ScannedProductRef,
) {
  const { t } = useTranslation();
  // Store mode's own entries for the list, read without asking the network:
  // it loaded every line to buy, and a second watcher's fetch would reset them.
  const toBuy = useQuery(
    GetShoppingListItemsFilteredDocument,
    listId
      ? {
          variables: {
            id: listId,
            first: PAGINATION.ITEMS_PAGE_SIZE,
            isPurchased: false,
          },
          fetchPolicy: 'cache-only',
        }
      : skipToken,
  );
  const cart = useQuery(
    GetShoppingListItemsFilteredDocument,
    listId
      ? {
          variables: {
            id: listId,
            first: PAGINATION.ITEMS_PAGE_SIZE,
            isPurchased: true,
          },
          fetchPolicy: 'cache-only',
        }
      : skipToken,
  );
  // A refused tick re-reads both tabs from the server, as store mode's does.
  const { toggleItem, recordPurchase } = useToggleShoppingItem({
    listId,
    refetch: () => Promise.all([toBuy.refetch(), cart.refetch()]),
  });

  const nodes = (data: typeof toBuy.data) =>
    data?.shoppingList?.itemsConnection.edges.map(edge => edge.node) ?? [];
  const match = matchScannedLine(nodes(toBuy.data), nodes(cart.data), scanned);
  const open = match && !match.inCart ? match.line : null;

  const line: PurchaseAmountItem | null = open
    ? {
        id: open.id,
        itemName: firstNonBlank(open.itemName) ?? t('labels.item'),
        requestedQuantity: open.quantity ?? 1,
        unitName: firstNonBlank(open.unit?.symbol, open.unitName) ?? null,
        // The price sheet's hint only: a typed estimate, else the suggestion.
        estimatedPrice:
          open.priceEstimate.estimated ?? open.suggestedPrice?.amount ?? null,
      }
    : null;

  return {
    /** The line left to buy that the scan fulfils, as the price sheet shows it. */
    line,
    /** A line for the product is already in the cart. */
    inCart: match?.inCart ?? false,
    /** Ticks a line; with what the price sheet took, records what it cost. */
    tick: (
      lineId: string,
      paid: { quantity: number; totalPrice: number | null } | null,
    ) =>
      paid
        ? recordPurchase(lineId, {
            purchasedQuantity: paid.quantity,
            // The sheet takes the total; the API stores per unit.
            purchasedPrice: unitPriceFromTotal(paid.totalPrice, paid.quantity),
          })
        : toggleItem(lineId),
  };
}
