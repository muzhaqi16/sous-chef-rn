import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import {
  MoveToPantryModal_ShoppingListItemFragmentDoc,
  MoveToPantryPurchaseInfoDocument,
} from '#features/shoppingList/components/moveToPantry/MoveToPantryModal.generated';

interface UseMoveToPantryItemArgs {
  shoppingListItemId: string | null | undefined;
  skip: boolean;
}

/** The line being moved, and what was actually bought on it. */
export function useMoveToPantryItem({
  shoppingListItemId,
  skip,
}: UseMoveToPantryItemArgs) {
  const { data, complete } = useFragment({
    fragment: MoveToPantryModal_ShoppingListItemFragmentDoc,
    fragmentName: 'MoveToPantryModal_shoppingListItem',
    from: shoppingListItemId
      ? { __typename: 'ShoppingListItem', id: shoppingListItemId }
      : null,
  });

  // A query, not the fragment above: that gates the whole sheet on `complete`,
  // and on a cold start the list query holds only `{ isPurchased movedToPantryAt }`,
  // so missing amounts would blank the sheet rather than just the prefill.
  const { data: purchaseData } = useQuery(
    MoveToPantryPurchaseInfoDocument,
    !skip && shoppingListItemId
      ? {
          variables: { id: shoppingListItemId },
          fetchPolicy: 'cache-first',
          // NOT `'all'`: a field error nulls the non-null `purchaseInfo` and so
          // `shoppingListItem`, which `'all'` WRITES onto the root field
          // ItemDetail reads, where it sticks and persists.
          errorPolicy: 'none',
        }
      : skipToken,
  );

  const purchaseInfo = purchaseData?.shoppingListItem?.purchaseInfo ?? null;

  return {
    shoppingListItem: shoppingListItemId && complete ? data : null,
    purchasedQuantity: purchaseInfo?.isPurchased
      ? purchaseInfo.purchasedQuantity ?? null
      : null,
    // PER UNIT, as the API stores it; the caller shows the total.
    purchasedUnitPrice: purchaseInfo?.isPurchased
      ? purchaseInfo.purchasedPrice ?? null
      : null,
    // What the purchase was recorded in. Only reached when the LINE carries no
    // unit of its own — the two agree otherwise, since the server derives one
    // from the other.
    purchasedUnit:
      purchaseData?.shoppingListItem?.purchasesConnection.edges[0]?.node ??
      null,
  };
}
