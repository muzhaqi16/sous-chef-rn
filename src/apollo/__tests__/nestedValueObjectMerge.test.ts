'use no memo';

// Mock the fragment matcher JSON before importing the module under test
jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {},
}));

import type { Unmasked } from '@apollo/client/masking';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { makeCache } from '../cache';
import {
  ItemDetail_ShoppingListItemFragmentDoc,
  type ItemDetail_ShoppingListItemFragment,
} from '#features/shoppingList/screens/ItemDetail.generated';
import {
  UseToggleShoppingItem_ItemFragmentDoc,
  type UseToggleShoppingItem_ItemFragment,
} from '#features/shoppingList/hooks/mutations/useToggleShoppingItem.generated';

/**
 * A nested object with no type policy is REPLACED on write, not merged
 * field-by-field. `ShoppingListItem.purchaseInfo` is read in full by exactly one
 * selection — ItemDetail's — and in the `{ isPurchased }` shape by eleven
 * others, including the list query that refetches on every visit and the item
 * subscription. So without the `ShoppingListItemPurchaseInfo` type policy, any
 * of those narrow writes strips four fields off the entity while the detail
 * screen is open, its fragment read goes incomplete, and the screen renders
 * "Item not found" over an item that is sitting right there in the cache.
 *
 * These tests use the real documents and the real `makeCache()`, so they fail
 * the moment the policy is removed.
 */

const ITEM_CACHE_ID = 'ShoppingListItem:si1';

const fullItem: Unmasked<ItemDetail_ShoppingListItemFragment> = {
  __typename: 'ShoppingListItem',
  brand: null,
  netWeight: null,
  netWeightUnit: null,
  id: 'si1',
  itemName: 'Lemon juice',
  quantity: 1,
  quantityInput: '1',
  displayFormat: DisplayFormat.Decimal,
  unitName: 'lemon',
  category: 'Produce',
  notes: null,
  priority: 0,
  createdAt: '2025-12-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  priceEstimate: { __typename: 'PriceEstimate', estimated: 2.5 },
  storeInfo: {
    __typename: 'ShoppingListItemStoreInfo',
    preferredStore: null,
  },
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: true,
    purchasedQuantity: 2,
    purchasedPrice: 3.5,
    purchaseDate: '2026-08-19T00:00:00.000Z',
    purchasedBy: {
      __typename: 'User',
      id: 'u1',
      profile: {
        __typename: 'UserProfile',
        id: 'profile-1',
        displayName: 'Sam',
        avatar: null,
      },
    },
  },
  source: {
    __typename: 'ShoppingListItemSource',
    isAutoAdded: false,
    autoAddReason: null,
    isFromMealPlan: false,
  },
  addedBy: {
    __typename: 'User',
    id: 'u1',
    email: 'sam@example.com',
    profile: {
      __typename: 'UserProfile',
      id: 'profile-1',
      displayName: 'Sam',
      avatar: null,
    },
  },
  lastEditedBy: null,
  item: null,
  purchaseHistory: {
    __typename: 'PurchaseHistorySummary',
    previouslyPurchased: true,
    purchaseCount: 2,
    lastPurchaseDate: '2026-08-19T00:00:00.000Z',
  },
};

/**
 * The shape a list refetch, a subscription push or a toggle response writes.
 *
 * `Unmasked<>` on both fixtures because that is what `cache.writeFragment`
 * takes — the masked type hides a nested fragment's fields behind
 * `$fragmentRefs`, which a literal cannot satisfy.
 */
const narrowItem: Unmasked<UseToggleShoppingItem_ItemFragment> = {
  __typename: 'ShoppingListItem',
  id: 'si1',
  itemName: 'Lemon juice',
  quantity: 1,
  quantityInput: '1',
  displayFormat: DisplayFormat.Decimal,
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: true,
  },
  version: 3,
  updatedAt: '2026-08-19T00:01:00.000Z',
  category: 'Produce',
  notes: null,
  unitName: 'lemon',
  unit: null,
  sortOrder: 'a0',
  item: null,
};

function seedFullItem() {
  const cache = makeCache();
  cache.writeFragment({
    id: ITEM_CACHE_ID,
    fragment: ItemDetail_ShoppingListItemFragmentDoc,
    fragmentName: 'ItemDetail_shoppingListItem',
    data: fullItem,
  });
  return cache;
}

function readDetail(cache: ReturnType<typeof makeCache>) {
  // `readFragment` returns null on an incomplete read, exactly as
  // ItemDetail's `useFragment(...).complete ? data : null` does.
  return cache.readFragment<ItemDetail_ShoppingListItemFragment>({
    id: ITEM_CACHE_ID,
    fragment: ItemDetail_ShoppingListItemFragmentDoc,
    fragmentName: 'ItemDetail_shoppingListItem',
  });
}

describe('nested value objects on ShoppingListItem', () => {
  it('survives a narrow purchaseInfo write', () => {
    const cache = seedFullItem();
    expect(readDetail(cache)).not.toBeNull();

    cache.writeFragment({
      id: ITEM_CACHE_ID,
      fragment: UseToggleShoppingItem_ItemFragmentDoc,
      fragmentName: 'useToggleShoppingItem_item',
      data: narrowItem,
    });

    const afterNarrowWrite = readDetail(cache);
    // Without the type policy this is null — the read is incomplete because
    // purchasedQuantity / purchasedPrice / purchaseDate / purchasedBy were
    // replaced away by a write that only knew about `isPurchased`.
    expect(afterNarrowWrite).not.toBeNull();
    expect(afterNarrowWrite?.purchaseInfo).toMatchObject({
      isPurchased: true,
      purchasedQuantity: 2,
      purchasedPrice: 3.5,
      purchaseDate: '2026-08-19T00:00:00.000Z',
    });
    expect(
      afterNarrowWrite?.purchaseInfo?.purchasedBy?.profile?.displayName,
    ).toBe('Sam');
  });

  it('takes the incoming value for fields the narrow write does carry', () => {
    const cache = seedFullItem();

    cache.writeFragment({
      id: ITEM_CACHE_ID,
      fragment: UseToggleShoppingItem_ItemFragmentDoc,
      fragmentName: 'useToggleShoppingItem_item',
      data: {
        ...narrowItem,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
        },
      },
    });

    // Merging preserves siblings; it does not make the object stale. The field
    // the writer actually selected still wins.
    expect(readDetail(cache)?.purchaseInfo?.isPurchased).toBe(false);
  });

  // The five purchase fields are ONE FACT. Preserving siblings across a write
  // that CHANGES `isPurchased` is what let a collaborator's purchase inherit
  // the previous purchaser's name and amounts — and gating the UI on
  // `isPurchased` cannot help, because `isPurchased` is exactly the field the
  // narrow write sets.
  describe('a write that changes isPurchased describes a different purchase', () => {
    const writeNarrowPurchaseState = (
      cache: ReturnType<typeof makeCache>,
      isPurchased: boolean,
    ) =>
      cache.writeFragment({
        id: ITEM_CACHE_ID,
        fragment: UseToggleShoppingItem_ItemFragmentDoc,
        fragmentName: 'useToggleShoppingItem_item',
        data: {
          ...narrowItem,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased,
          },
        },
      });

    it('clears the previous purchase rather than attributing it to the new one', () => {
      const cache = seedFullItem();

      // A collaborator unmarks the item, then buys it themselves. Only
      // `isPurchased` travels on the subscription push.
      writeNarrowPurchaseState(cache, false);
      writeNarrowPurchaseState(cache, true);

      const purchaseInfo = readDetail(cache)?.purchaseInfo;
      expect(purchaseInfo?.isPurchased).toBe(true);
      expect(purchaseInfo?.purchasedBy).toBeNull();
      expect(purchaseInfo?.purchasedQuantity).toBeNull();
      expect(purchaseInfo?.purchasedPrice).toBeNull();
      expect(purchaseInfo?.purchaseDate).toBeNull();
    });

    it('clears by writing null, so the detail screen still renders', () => {
      const cache = seedFullItem();

      writeNarrowPurchaseState(cache, false);

      // Removing the fields would read incomplete and blank the screen — the
      // exact bug the type policy exists to prevent. Every dependent field is
      // nullable, so clearing them keeps the read complete.
      expect(readDetail(cache)).not.toBeNull();
      expect(readDetail(cache)?.purchaseInfo?.purchasedBy).toBeNull();
    });

    it('still merges field-wise while isPurchased is unchanged', () => {
      const cache = seedFullItem();

      // A list refetch of an item nobody has touched: same purchase, partial
      // selection. The amounts must survive.
      writeNarrowPurchaseState(cache, true);

      expect(readDetail(cache)?.purchaseInfo).toMatchObject({
        isPurchased: true,
        purchasedQuantity: 2,
        purchasedPrice: 3.5,
      });
    });
  });
});
