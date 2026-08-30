/**
 * `writePurchaseInfo` against the REAL cache, so the type policy runs.
 *
 * The sibling suite in `shoppingListCacheUpdaters.test.ts` hand-drives a mocked
 * `cache.modify`, which can only observe what the modifier returns — never what
 * the cache does with it. That is precisely the gap this covers: the record's
 * clear-on-flip rule lives in `ShoppingListItemPurchaseInfo.merge`
 * (`src/apollo/cache.ts`), and a writer that bypasses the merge drops the rule
 * while its docblock goes on asserting it.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { writePurchaseInfo } from '../shoppingListCacheUpdaters';

const ROW = gql`
  fragment PurchaseRow on ShoppingListItem {
    __typename
    id
    purchaseInfo {
      __typename
      isPurchased
      purchasedQuantity
      purchasedPrice
      purchaseDate
      movedToPantryAt
    }
  }
`;

type Row = {
  purchaseInfo: {
    isPurchased: boolean;
    purchasedQuantity: number | null;
    purchasedPrice: number | null;
    purchaseDate: string | null;
    movedToPantryAt: string | null;
  };
};

const seed = (
  overrides: Partial<Row['purchaseInfo']> = {},
): ReturnType<typeof makeCache> => {
  const cache = makeCache();
  cache.writeFragment({
    id: 'ShoppingListItem:sli-1',
    fragment: ROW,
    data: {
      __typename: 'ShoppingListItem',
      id: 'sli-1',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: true,
        purchasedQuantity: 3,
        purchasedPrice: 9.5,
        purchaseDate: '2026-01-01',
        movedToPantryAt: null,
        ...overrides,
      },
    },
  });
  return cache;
};

const read = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<Row>({ id: 'ShoppingListItem:sli-1', fragment: ROW })
    ?.purchaseInfo;

describe('writePurchaseInfo', () => {
  it('carries the recorded purchase through a flip', () => {
    const cache = seed();

    writePurchaseInfo(cache, 'sli-1', { isPurchased: false });

    const after = read(cache);
    expect(after?.isPurchased).toBe(false);
    // The type policy clears every field a write OMITS when the flag changes —
    // written for a narrow server response, which describes a different
    // purchase. A local flip is not that: the SDL documents a clearing contract
    // for `movedToPantryAt` alone, and these amounts are the server's record,
    // not this write's to discard. The writer carries them so the policy has
    // nothing to clear.
    expect(after?.purchasedQuantity).toBe(3);
    expect(after?.purchasedPrice).toBe(9.5);
    expect(after?.purchaseDate).toBe('2026-01-01');
  });

  it('does not invent a value for a field the cache does not hold', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingListItem:sli-1',
      fragment: gql`
        fragment SparseRow on ShoppingListItem {
          __typename
          id
          purchaseInfo {
            __typename
            isPurchased
          }
        }
      `,
      data: {
        __typename: 'ShoppingListItem',
        id: 'sli-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
        },
      },
    });

    writePurchaseInfo(cache, 'sli-1', { isPurchased: true });

    const stored = cache.extract()['ShoppingListItem:sli-1'] as {
      purchaseInfo?: Record<string, unknown>;
    };
    expect(stored.purchaseInfo?.isPurchased).toBe(true);
    expect('purchasedQuantity' in (stored.purchaseInfo ?? {})).toBe(false);
  });

  it('preserves the record when the flag does not change', () => {
    const cache = seed({ movedToPantryAt: '2026-02-02' });

    // A stamp-only write is a partial read of the SAME purchase, so nothing
    // else may be disturbed.
    writePurchaseInfo(cache, 'sli-1', { movedToPantryAt: '2026-03-03' });

    const after = read(cache);
    expect(after?.isPurchased).toBe(true);
    expect(after?.purchasedQuantity).toBe(3);
    expect(after?.purchasedPrice).toBe(9.5);
    expect(after?.purchaseDate).toBe('2026-01-01');
    expect(after?.movedToPantryAt).toBe('2026-03-03');
  });

  it('never lets a caller that does not name the flag change it', () => {
    const cache = seed({ isPurchased: false, purchasedQuantity: null });

    writePurchaseInfo(cache, 'sli-1', { movedToPantryAt: '2026-03-03' });

    expect(read(cache)?.isPurchased).toBe(false);
  });

  it('clears the stocked stamp on a flip, because the server does', () => {
    const cache = seed({ movedToPantryAt: '2026-02-02' });

    writePurchaseInfo(cache, 'sli-1', { isPurchased: false });

    expect(read(cache)?.movedToPantryAt).toBeNull();
  });

  it('restores a snapshot without re-clearing what the flip cleared', () => {
    // The revert path. The user un-purchased a line that was already moved to
    // the pantry, and the server refused. Restoring the previous flag is NOT a
    // second flip — the stamp the server still holds must come back, and the
    // toggle's snapshot is the only record of it.
    const cache = seed({ movedToPantryAt: '2026-02-02' });

    writePurchaseInfo(cache, 'sli-1', { isPurchased: false });
    expect(read(cache)?.movedToPantryAt).toBeNull();

    writePurchaseInfo(
      cache,
      'sli-1',
      { isPurchased: true, movedToPantryAt: '2026-02-02' },
      { restoring: true },
    );

    const after = read(cache);
    expect(after?.isPurchased).toBe(true);
    // Without this the row re-offers move-to-pantry and a bulk move sends the
    // line to the pantry a second time.
    expect(after?.movedToPantryAt).toBe('2026-02-02');
  });

  it('is a no-op for an unidentifiable row', () => {
    const cache = makeCache();
    expect(() =>
      writePurchaseInfo(cache, '', { isPurchased: true }),
    ).not.toThrow();
  });
});
