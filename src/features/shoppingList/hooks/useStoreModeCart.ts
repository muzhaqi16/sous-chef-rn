import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { heldFetchPolicy } from '#hooks/apollo/standDownOptions';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import {
  matchScannedLine,
  type ScannedProductRef,
} from '#features/shoppingList/utils/matchScannedLine';
import { useToggleShoppingItem } from './mutations/useToggleShoppingItem';
import { unitPriceFromTotal } from '#features/shoppingList/utils/purchasePrice';
import type { PurchaseAmountItem } from './usePurchaseAmountModal';
import type { PurchasedItemInput } from '#/graphql/generated/schemaTypes';
import { useListCurrency } from './useListCurrency';

/**
 * Store mode's cart for a scanned product: the list line it fulfils and how to
 * tick it. The lines come from what store mode already holds, so a shelf with
 * no signal still matches.
 */
export function useStoreModeCart(
  listId: string | undefined,
  scanned: ScannedProductRef & { variationId?: string },
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
          ...heldFetchPolicy('cache-only'),
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
          ...heldFetchPolicy('cache-only'),
        }
      : skipToken,
  );
  const recordsIn = useListCurrency(listId);
  // A refused tick re-reads both tabs from the server, as store mode's does.
  const { claimPurchased, recordPurchase } = useToggleShoppingItem({
    listId,
    refetch: () => Promise.all([toBuy.refetch(), cart.refetch()]),
  });

  const nodes = (data: typeof toBuy.data) =>
    data?.shoppingList?.itemsConnection.edges.map(edge => edge.node) ?? [];
  const match = matchScannedLine(nodes(toBuy.data), nodes(cart.data), scanned);
  const open = match && !match.inCart ? match.line : null;

  // The tick records the price on the product scanned, at its barcode's pack,
  // even when the line names a concept above it.
  const bought: PurchasedItemInput = scanned.variationId
    ? { variation: scanned.variationId }
    : { itemId: scanned.id };

  // The hint is a bare number, so a suggestion in another currency would read
  // as one in the list's.
  const suggested =
    open?.suggestedPrice?.currency.code === recordsIn
      ? open.suggestedPrice.amount
      : null;
  const line: PurchaseAmountItem | null = open
    ? {
        id: open.id,
        itemName: firstNonBlank(open.itemName) ?? t('labels.item'),
        requestedQuantity: open.quantity ?? 1,
        unitName: firstNonBlank(open.unit?.symbol, open.unitName) ?? null,
        // The price sheet's hint only: a typed estimate, else the suggestion.
        estimatedPrice: open.priceEstimate.estimated ?? suggested,
      }
    : null;

  return {
    /** The line left to buy that the scan fulfils, as the price sheet shows it. */
    line,
    /** The unit the line counts in; null for a line with none of its own. */
    unit: open?.unit ? { id: open.unit.id, symbol: open.unit.symbol } : null,
    /** A line for the product is already in the cart. */
    inCart: match?.inCart ?? false,
    /**
     * Puts a line in the cart, never out of it (another member may have
     * ticked it already); with what the price sheet took, records what it cost.
     */
    tick: (
      lineId: string,
      paid: { quantity: number; totalPrice: number | null } | null,
    ) =>
      paid
        ? recordPurchase(
            lineId,
            {
              purchasedQuantity: paid.quantity,
              // The sheet takes the total; the API stores per unit.
              purchasedPrice: unitPriceFromTotal(
                paid.totalPrice,
                paid.quantity,
              ),
            },
            bought,
          )
        : claimPurchased(lineId, bought),
  };
}
