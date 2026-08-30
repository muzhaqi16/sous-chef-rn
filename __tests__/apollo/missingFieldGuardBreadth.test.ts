/**
 * What the missing-field guard suppresses, and what it still reports.
 *
 * An exemption is a hole cut in a guard. Cut to the shape of the case it
 * documents it stays a documented case; cut wider it disables the guard for
 * everything that falls through — and most reliably for the subjects the guard
 * was written for, because those are the ones the exemption was written near.
 *
 * The previous exemption matched the `util.format`ed message for the string
 * `ShoppingListItemPurchaseInfo`. Apollo renders the whole record with `%o`, so
 * that pattern matched every diagnostic about every field of every payload
 * containing a purchase record: an instrumented run over
 * `src/features/shoppingList src/apollo` captured 92 suppressed writes, 90
 * through that one branch. This file is the demonstration the replacement owes.
 */
import { gql } from '@apollo/client';
import { writePurchaseInfo } from '#/apollo/utils/shoppingListCacheUpdaters';
import {
  createApolloTestWrapper,
  recordMock,
  seedCache,
} from '#/test-utils/apolloMockProvider';

/** A tiny real operation to complete a partial fixture against. */
const UnitsDocument = gql`
  query GuardProbeUnits {
    units {
      id
      name
    }
  }
`;

const guard = require('../setup/apolloCacheWriteGuard') as {
  isExpectedMissingField: (args: unknown[]) => boolean;
  peekCollectedCacheWriteErrors: () => Array<{
    testName: string;
    message: string;
  }>;
  reportCollectedCacheWriteErrors: (where: string) => void;
  resetCollectedCacheWriteErrors: () => void;
};

/** Exactly how Apollo raises it: `invariant.error(116, fieldName, record)`. */
const raise = (field: string, record: Record<string, unknown>) =>
  console.error(
    "Missing field '%s' while writing result %o",
    field,
    record,
  );

const purchaseRecord = {
  __typename: 'ShoppingListItemPurchaseInfo',
  isPurchased: true,
  movedToPantryAt: null,
};

const itemCarryingPurchaseInfo = {
  __typename: 'ShoppingListItem',
  id: 'item-1',
  purchaseInfo: purchaseRecord,
};

/** Read what the live spy collected, then clear so `afterEach` stays quiet. */
function drain() {
  const entries = guard.peekCollectedCacheWriteErrors();
  guard.resetCollectedCacheWriteErrors();
  return entries;
}

afterEach(() => {
  guard.resetCollectedCacheWriteErrors();
});

describe('the missing-field guard exempts nothing', () => {
  it('still reports a missing field on a payload that merely contains a purchase record', () => {
    // The regression the old key allowed. `quantity` is missing from a
    // `ShoppingListItem`; the payload happens to carry a purchase record, which
    // used to be enough to silence it.
    raise('quantity', itemCarryingPurchaseInfo);

    const [entry, ...rest] = drain();
    expect(rest).toEqual([]);
    expect(entry.message).toContain("Missing field 'quantity'");
  });

  it('reports every field of the purchase record, exempting none', () => {
    // These five were the one entry the exemption ever held, on the grounds
    // that `writePurchaseInfo` reported them in production too. It did — by
    // asserting a fragment wider than the write. The fragment now narrows to
    // the write, so nothing here is expected any more and the map is empty.
    const fields = [
      'isPurchased',
      'movedToPantryAt',
      'purchaseDate',
      'purchasedBy',
      'purchasedById',
      'purchasedPrice',
      'purchasedQuantity',
    ];
    for (const field of fields) raise(field, purchaseRecord);

    expect(drain().map(e => e.message)).toEqual(
      fields.map(field =>
        expect.stringContaining(`Missing field '${field}'`),
      ),
    );
  });

  it('falls closed when the diagnostic does not arrive in the documented shape', () => {
    // The empty map makes this vacuous today and load-bearing the moment an
    // entry is argued for: an exemption that cannot read its own key must
    // report rather than excuse. Kept because that is the property a future
    // entry inherits, and it is not one anybody re-derives when adding one.
    expect(guard.isExpectedMissingField([
      "Missing field '%s' while writing result %o",
      undefined,
      purchaseRecord,
    ])).toBe(false);
    expect(guard.isExpectedMissingField([
      "Missing field '%s' while writing result %o",
      'purchaseDate',
      null,
    ])).toBe(false);
    expect(guard.isExpectedMissingField([
      "Missing field '%s' while writing result %o",
      'purchaseDate',
      'ShoppingListItemPurchaseInfo',
    ])).toBe(false);
  });
});

describe('a partial mock excuses its own omissions and nothing else', () => {
  // The opt-out used to be a whole-test boolean that cleared every collected
  // diagnostic: one deliberately-partial mock switched the guard off for every
  // other mock, every `writeFragment` and every subscription write in the test.
  // Measured across the suite, two tests opting out for one field each were
  // silencing 27 diagnostics spread over six types.
  beforeEach(() => {
    (
      globalThis as { __apolloPartialFieldExemptions?: Set<string> }
    ).__apolloPartialFieldExemptions = new Set(['Item.canEdit']);
  });

  it('suppresses the exact field the partial payload omits', () => {
    raise('canEdit', { __typename: 'Item', id: 'i-1' });
    expect(drain()).toEqual([]);
  });

  it('still reports another field of the same record', () => {
    raise('name', { __typename: 'Item', id: 'i-1' });
    expect(drain()).toHaveLength(1);
  });

  it('still reports the same field name on another record', () => {
    raise('canEdit', { __typename: 'Unit', id: 'u-1' });
    expect(drain()).toHaveLength(1);
  });

  it('registers the omitted fields from the mock itself', () => {
    (
      globalThis as { __apolloPartialFieldExemptions?: Set<string> }
    ).__apolloPartialFieldExemptions = new Set();

    const partial = recordMock(UnitsDocument, {
      data: { units: [{ __typename: 'Unit', id: 'u-1' }] },
      partial: true,
    });
    createApolloTestWrapper({ operationMocks: [partial.mock] });

    const registered = (
      globalThis as { __apolloPartialFieldExemptions?: Set<string> }
    ).__apolloPartialFieldExemptions;
    // Derived from the payload, so it names fields the operation selects and
    // this fixture leaves out — and only those.
    expect(registered?.has('Unit.name')).toBe(true);
    expect(registered?.has('Unit.id')).toBe(false);
    expect([...(registered ?? [])].every(pair => pair.startsWith('Unit.'))).toBe(
      true,
    );
  });
});

describe('the report names the test that produced the write', () => {
  it('groups collected diagnostics by their originating test', () => {
    raise('quantity', itemCarryingPurchaseInfo);

    let thrown: Error | undefined;
    try {
      guard.reportCollectedCacheWriteErrors('afterEach');
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toContain(
      'groups collected diagnostics by their originating test',
    );
    expect(thrown?.message).toContain("Missing field 'quantity'");
  });

  it('says so when the write landed after the last test finished', () => {
    raise('quantity', itemCarryingPurchaseInfo);

    expect(() => guard.reportCollectedCacheWriteErrors('afterAll')).toThrow(
      /landed after the last test in the file finished/,
    );
  });
});

describe('the real writer is still silent', () => {
  it('reports nothing when writePurchaseInfo flips a partially cached record', () => {
    const cache = seedCache([
      {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
          movedToPantryAt: null,
        },
      },
    ]);

    writePurchaseInfo(cache, 'item-1', { isPurchased: true });

    expect(drain()).toEqual([]);
    // And the write itself landed, so the silence is not the write failing.
    const stored = cache.readFragment<{
      purchaseInfo?: { isPurchased?: boolean };
    }>({
      id: 'ShoppingListItem:item-1',
      fragment: gql`
        fragment _GuardProbe on ShoppingListItem {
          purchaseInfo {
            isPurchased
          }
        }
      `,
      returnPartialData: true,
    });
    expect(stored?.purchaseInfo?.isPurchased).toBe(true);
  });
});
