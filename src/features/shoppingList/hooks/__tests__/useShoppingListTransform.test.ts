'use no memo';
import { renderHook } from '@testing-library/react-native';
import type { ShoppingListItemNode } from '../usePaginatedShoppingItems';
import { useShoppingListTransformMulti } from '../useShoppingListTransform';

/**
 * After the per-cell `useFragment` migration the transform hook no longer
 * computes display data — each row owns its own rendering. The remaining
 * `useShoppingListTransformMulti` just wraps connection nodes into the
 * lightweight FlashList row shape (`id`, `isPurchased`, `sortOrder`,
 * `itemRef`) and pins `isPurchased` to the tab it came from.
 */

// Build a minimal ShoppingListItemNode-shaped stub that satisfies the wrap
// helper (it only reads `id`, `itemName`, `sortOrder`).
// Allow `null` overrides so tests can exercise the "skip invalid item" path
// (e.g. a missing `id` / `itemName`).
type NodeOverrides = Partial<{
  [K in keyof ShoppingListItemNode]: ShoppingListItemNode[K] | null;
}>;
function node(overrides: NodeOverrides = {}): ShoppingListItemNode {
  return {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    itemName: 'Milk',
    sortOrder: 'aaa',
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    },
    ...overrides,
  } as Partial<ShoppingListItemNode> as ShoppingListItemNode;
}

describe('useShoppingListTransformMulti', () => {
  it('wraps unpurchased and purchased nodes into row items', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [node({ id: '1' })],
        rawPurchasedItems: [node({ id: '2' })],
      }),
    );

    expect(result.current.unpurchasedItems).toHaveLength(1);
    expect(result.current.purchasedItems).toHaveLength(1);
    expect(result.current.unpurchasedItems[0].id).toBe('1');
    expect(result.current.purchasedItems[0].id).toBe('2');
  });

  it('pins isPurchased to the unpurchased tab regardless of server value', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [
          node({
            id: '1',
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
            },
          }),
        ],
        rawPurchasedItems: [],
      }),
    );

    expect(result.current.unpurchasedItems[0].isPurchased).toBe(false);
  });

  it('pins isPurchased to the purchased tab regardless of server value', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [],
        rawPurchasedItems: [
          node({
            id: '1',
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: false,
            },
          }),
        ],
      }),
    );

    expect(result.current.purchasedItems[0].isPurchased).toBe(true);
  });

  it('skips invalid items (missing id or itemName)', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [
          node({ id: null, itemName: 'Milk' }),
          node({ id: '2', itemName: null }),
          node({ id: '3', itemName: 'Valid' }),
        ],
        rawPurchasedItems: [],
      }),
    );

    expect(result.current.unpurchasedItems).toHaveLength(1);
    expect(result.current.unpurchasedItems[0].id).toBe('3');
  });

  it('preserves sortOrder on the row wrapper', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [node({ id: '1', sortOrder: 'zzz' })],
        rawPurchasedItems: [],
      }),
    );

    expect(result.current.unpurchasedItems[0].sortOrder).toBe('zzz');
  });

  it('exposes the node as a fragment ref on `itemRef`', () => {
    const n = node({ id: '1' });
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [n],
        rawPurchasedItems: [],
      }),
    );

    expect(result.current.unpurchasedItems[0].itemRef).toBe(n);
  });

  it('returns stable arrays when input arrays are stable', () => {
    const unpurchased = [node({ id: '1' })];
    const purchased = [node({ id: '2' })];

    const { result, rerender } = renderHook(
      (props: { u: ShoppingListItemNode[]; p: ShoppingListItemNode[] }) =>
        useShoppingListTransformMulti({
          rawUnpurchasedItems: props.u,
          rawPurchasedItems: props.p,
        }),
      { initialProps: { u: unpurchased, p: purchased } },
    );

    const firstUnpurchased = result.current.unpurchasedItems;
    rerender({ u: unpurchased, p: purchased });
    expect(result.current.unpurchasedItems).toBe(firstUnpurchased);
  });

  it('reuses row objects for unchanged nodes when a page append yields a new source array', () => {
    // A fetchMore gives Apollo a new nodes array while structural sharing
    // keeps every existing node identical. FlashList re-renders a cell only
    // when its `item` changes identity, so the rows for the existing nodes
    // must be the same objects — otherwise every mounted cell re-renders to
    // show the appended ones.
    const first = node({ id: '1' });
    const second = node({ id: '2' });

    const { result, rerender } = renderHook(
      (props: { u: ShoppingListItemNode[] }) =>
        useShoppingListTransformMulti({
          rawUnpurchasedItems: props.u,
          rawPurchasedItems: [],
        }),
      { initialProps: { u: [first] } },
    );

    const rowBefore = result.current.unpurchasedItems[0];
    rerender({ u: [first, second] });

    expect(result.current.unpurchasedItems).toHaveLength(2);
    expect(result.current.unpurchasedItems[0]).toBe(rowBefore);
    expect(result.current.unpurchasedItems[1].id).toBe('2');
  });

  it('produces a new row when the node object itself changes', () => {
    // Apollo emits a new node object whenever any of its fields change, so
    // row identity must follow node identity — a reorder must not be hidden
    // behind a stale cached row.
    const before = node({ id: '1', sortOrder: 'aaa' });
    const after = node({ id: '1', sortOrder: 'bbb' });

    const { result, rerender } = renderHook(
      (props: { u: ShoppingListItemNode[] }) =>
        useShoppingListTransformMulti({
          rawUnpurchasedItems: props.u,
          rawPurchasedItems: [],
        }),
      { initialProps: { u: [before] } },
    );

    const rowBefore = result.current.unpurchasedItems[0];
    rerender({ u: [after] });

    expect(result.current.unpurchasedItems[0]).not.toBe(rowBefore);
    expect(result.current.unpurchasedItems[0].sortOrder).toBe('bbb');
  });

  it('keeps separate rows per tab for the same node', () => {
    // While a toggle is in flight the same node can sit in both tabs, wrapped
    // with a different pinned `isPurchased` on each.
    const shared = node({ id: '1' });

    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [shared],
        rawPurchasedItems: [shared],
      }),
    );

    expect(result.current.unpurchasedItems[0]).not.toBe(
      result.current.purchasedItems[0],
    );
    expect(result.current.unpurchasedItems[0].isPurchased).toBe(false);
    expect(result.current.purchasedItems[0].isPurchased).toBe(true);
  });

  it('returns empty arrays for empty inputs', () => {
    const { result } = renderHook(() =>
      useShoppingListTransformMulti({
        rawUnpurchasedItems: [],
        rawPurchasedItems: [],
      }),
    );

    expect(result.current.unpurchasedItems).toEqual([]);
    expect(result.current.purchasedItems).toEqual([]);
  });
});
