/**
 * `writePurchaseInfo` against the REAL cache, so the type policy runs. The
 * record's clear-on-flip rule lives in `ShoppingListItemPurchaseInfo.merge`
 * (`src/features/shoppingList/cache/typePolicies.ts`), which a mocked
 * `cache.modify` cannot observe — it sees only what the modifier returns, never
 * what the cache does with it.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { writePurchaseInfo } from '../purchase';

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

describe('writePurchaseInfo — the stamp it leaves', () => {
  const RECORD = gql`
    fragment WritePurchaseInfoProbe on ShoppingListItem {
      id
      purchaseInfo {
        isPurchased
        movedToPantryAt
        purchasedQuantity
        purchasedPrice
      }
      updatedAt
    }
  `;

  function seedRecord(overrides: Record<string, unknown> = {}) {
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingListItem:i1',
      fragment: RECORD,
      data: {
        __typename: 'ShoppingListItem',
        id: 'i1',
        updatedAt: '2026-01-01T00:00:00.000Z',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: '2026-08-28T10:00:00.000Z',
          purchasedQuantity: 3,
          purchasedPrice: 2.5,
          ...overrides,
        },
      },
    });
    return cache;
  }

  const readRecord = (cache: { readFragment: Function }) =>
    cache.readFragment({
      id: 'ShoppingListItem:i1',
      fragment: RECORD,
      returnPartialData: true,
    }) as {
      updatedAt: string;
      purchaseInfo: {
        isPurchased: boolean;
        movedToPantryAt: string | null;
        purchasedQuantity: number | null;
        purchasedPrice: number | null;
      };
    } | null;

  it('clears the stamp when the flag flips', () => {
    const cache = seedRecord();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });

    // The server clears the stamp on this transition; the local write matches.
    expect(readRecord(cache)?.purchaseInfo.movedToPantryAt).toBeNull();
    expect(readRecord(cache)?.purchaseInfo.isPurchased).toBe(false);
  });

  it('keeps the rest of the record when the flag flips', () => {
    const cache = seedRecord();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });

    // The amounts describe a purchase the server recorded. Only the stamp is
    // derived from the flag.
    expect(readRecord(cache)?.purchaseInfo.purchasedQuantity).toBe(3);
    expect(readRecord(cache)?.purchaseInfo.purchasedPrice).toBe(2.5);
  });

  it('preserves the stamp when the flag is unchanged', () => {
    const cache = seedRecord();
    writePurchaseInfo(cache, 'i1', { isPurchased: true });

    expect(readRecord(cache)?.purchaseInfo.movedToPantryAt).toBe(
      '2026-08-28T10:00:00.000Z',
    );
  });

  it('sets the stamp without touching the flag', () => {
    const cache = seedRecord({ isPurchased: false, movedToPantryAt: null });
    writePurchaseInfo(cache, 'i1', {
      movedToPantryAt: '2026-08-29T00:00:00.000Z',
    });

    // A stamp-only write must not assert a flag it does not own — asserting
    // `true` over a cached `false` is what cleared the record.
    expect(readRecord(cache)?.purchaseInfo.isPurchased).toBe(false);
    expect(readRecord(cache)?.purchaseInfo.movedToPantryAt).toBe(
      '2026-08-29T00:00:00.000Z',
    );
    expect(readRecord(cache)?.purchaseInfo.purchasedQuantity).toBe(3);
  });

  it('writes updatedAt only when asked', () => {
    const cache = seedRecord();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });
    expect(readRecord(cache)?.updatedAt).toBe('2026-01-01T00:00:00.000Z');

    writePurchaseInfo(
      cache,
      'i1',
      { isPurchased: true },
      { updatedAt: '2026-08-29T12:00:00.000Z' },
    );
    expect(readRecord(cache)?.updatedAt).toBe('2026-08-29T12:00:00.000Z');
  });

  it('does nothing for an entity the cache cannot identify', () => {
    const cache = makeCache();
    expect(() =>
      writePurchaseInfo(cache, '', { isPurchased: true }),
    ).not.toThrow();
  });
});
