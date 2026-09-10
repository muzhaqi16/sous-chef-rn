/**
 * The cache read behind every list copy: `listFromTemplate` and
 * `nextRecurringList` both start from one of these.
 */

import type { ApolloCache } from '@apollo/client';
import {
  CopyableShoppingListFragmentDoc,
  type CopyableShoppingListFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import type {
  CopyableLine,
  CopyableList,
} from '#features/shoppingList/utils/listFromTemplate';
import { errorService } from '#/services/errorService';

/**
 * Lines read per purchase state. `first` is not a keyArg on
 * `ShoppingList.itemsConnection`, so this reads whatever the items screen
 * cached rather than slicing it — the number bounds the SERVER's answer when
 * the same shape is fetched.
 */
export const COPYABLE_ITEM_LIMIT = 100;

/**
 * The list a copy starts from, or null when the cache does not hold it whole —
 * a template nobody has opened has no lines to copy, and a partial copy would
 * be worse than none.
 */
export function readCopyableList(
  cache: ApolloCache,
  id: string,
): CopyableList | null {
  const cacheId = cache.identify({ __typename: 'ShoppingList', id });
  if (!cacheId) return null;

  let source;
  try {
    source = cache.readFragment<CopyableShoppingListFragment>({
      id: cacheId,
      fragment: CopyableShoppingListFragmentDoc,
      fragmentName: 'CopyableShoppingListFragment',
      variables: { copyableItemLimit: COPYABLE_ITEM_LIMIT },
    });
  } catch (error) {
    errorService.reportError(error, { operation: 'Read copyable list' });
  }
  if (!source) return null;

  return {
    id: source.id,
    name: source.name,
    description: source.description,
    budgetAmount: source.budgetAmount,
    tags: source.tags,
    homeId: source.homeId,
    lines: [
      ...source.unpurchasedLines.edges,
      ...source.purchasedLines.edges,
    ].map(edge => toLine(edge.node)),
  };
}

type CachedLine =
  CopyableShoppingListFragment['unpurchasedLines']['edges'][number]['node'];

const toLine = (node: CachedLine): CopyableLine => ({
  id: node.id,
  itemName: node.itemName,
  quantity: node.quantity,
  quantityInput: node.quantityInput,
  category: node.category,
  notes: node.notes,
  unitName: node.unitName,
  unitId: node.unit?.id,
  itemId: node.item?.id,
  sortOrder: node.sortOrder,
});
