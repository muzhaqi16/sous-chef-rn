import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode, UnitType } from '#/graphql/generated/schemaTypes';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { ScannedItem } from '../../types';
import { useAddScannedItem } from '../useAddScannedItem';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

/**
 * Offline no payload arrives, so the row is bumped locally; online the payload
 * carries the server's count and the version the restock bumped.
 */

const QUANTITY = gql`
  fragment _RestockProbe on PantryItem {
    id
    quantity
  }
`;

const ROW_ID = 'pi-oats';

const SCANNED: ScannedItem = {
  id: 'item-oats',
  name: 'Oats',
  upc: '0001',
  canEdit: false,
  canSuggest: true,
};

const ADDED_ITEM = gql`
  fragment _RestockAddedItemProbe on PantryItem {
    id
    item {
      id
    }
  }
`;

const EXPIRY = gql`
  fragment _RestockExpiryProbe on PantryItem {
    id
    expiresOn
  }
`;

/** A row counted in bags, so one scanned container restocks it by one. */
function cacheWithRow(quantity: number) {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: gql`
      fragment _RestockCountedRow on PantryItem {
        id
        quantity
        unit {
          id
          type
          symbol
        }
      }
    `,
    data: {
      __typename: 'PantryItem',
      id: ROW_ID,
      quantity,
      unit: {
        __typename: 'Unit',
        id: 'unit-bag',
        type: UnitType.Count,
        symbol: 'bag',
      },
    },
  });
  return cache;
}

const readQuantity = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<{ quantity: number }>({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: QUANTITY,
  })?.quantity;

const restockAnswer = (
  data: MockDataFor<typeof RestockPantryItemDocument>,
): MockFor<typeof RestockPantryItemDocument> => ({
  request: {
    query: RestockPantryItemDocument,
    variables: () => true,
  },
  result: { data },
});

describe('restocking the row a scan duplicated', () => {
  it('counts the scanned unit on the row it restocked', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'RestockPantryItemPayload',
              pantryItemUsage: {
                __typename: 'PantryItemUsage',
                pantryItem: {
                  __typename: 'PantryItem',
                  id: ROW_ID,
                  quantity: 4,
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID);
    });

    expect(readQuantity(cache)).toBe(4);
  });

  it("shows the server's default expiry on the restocked row once the response lands", async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'RestockPantryItemPayload',
              pantryItemUsage: {
                __typename: 'PantryItemUsage',
                pantryItem: {
                  __typename: 'PantryItem',
                  id: ROW_ID,
                  quantity: 4,
                  expiresOn: '2026-10-15',
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID);
    });

    expect(
      cache.readFragment<{ expiresOn: string | null }>({
        id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
        fragment: EXPIRY,
      })?.expiresOn,
    ).toBe('2026-10-15');
  });

  it('sends the day of the restock on the input, for its default expiry', async () => {
    const restock = recordMock(RestockPantryItemDocument, {
      data: {
        restockPantryItem: {
          __typename: 'RestockPantryItemPayload',
          pantryItemUsage: {
            __typename: 'PantryItemUsage',
            pantryItem: { __typename: 'PantryItem', id: ROW_ID, quantity: 4 },
          },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      { cache: cacheWithRow(3), operationMocks: [restock.mock] },
    );

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID);
    });

    const [fired] = restock.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fired?.input).toMatchObject({ today: fired?.today });
  });

  it('puts the count back when the restock is refused', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'NotFoundError',
              code: ErrorCode.NotFound,
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID);
    });

    expect(readQuantity(cache)).toBe(3);
  });

  it('takes the version the restock returns, so the next edit is not a conflict', async () => {
    const VERSION = gql`
      fragment _RestockVersionProbe on PantryItem {
        id
        version
      }
    `;
    const cache = cacheWithRow(3);
    cache.writeFragment({
      id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
      fragment: VERSION,
      data: { __typename: 'PantryItem', id: ROW_ID, version: 4 },
    });
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'RestockPantryItemPayload',
              pantryItemUsage: {
                __typename: 'PantryItemUsage',
                pantryItem: {
                  __typename: 'PantryItem',
                  id: ROW_ID,
                  quantity: 4,
                  version: 5,
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID);
    });

    expect(
      cache.readFragment<{ version: number }>({
        id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
        fragment: VERSION,
      })?.version,
    ).toBe(5);
  });

  describe('what one scanned container restocks', () => {
    const heldIn = (type: UnitType, unitId: string) => {
      const cache = cacheWithRow(3);
      cache.writeFragment({
        id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
        fragment: gql`
          fragment _RestockStackUnit on PantryItem {
            id
            unit {
              id
              type
              symbol
            }
          }
        `,
        data: {
          __typename: 'PantryItem',
          id: ROW_ID,
          unit: { __typename: 'Unit', id: unitId, type, symbol: unitId },
        },
      });
      return cache;
    };
    const firedAmount = async (
      cache: ReturnType<typeof makeCache>,
      packageSize?: { netWeight: number; netWeightUnitId: string },
    ) => {
      const restock = recordMock(RestockPantryItemDocument, {
        data: { restockPantryItem: null },
      });
      const { result } = renderHookWithApollo(
        () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
        { cache, operationMocks: [restock.mock] },
      );
      await act(async () => {
        await result.current.restockDuplicate(SCANNED, ROW_ID, packageSize);
      });
      return (restock.fired[0]?.input as { amount: unknown }).amount;
    };

    it('is one of a counted stack', async () => {
      expect(await firedAmount(heldIn(UnitType.Count, 'unit-bottle'))).toEqual({
        measured: { quantity: 1, unitId: 'unit-bottle' },
      });
    });

    it('is one package of the size entered, on a stack held by volume', async () => {
      const size = { netWeight: 500, netWeightUnitId: 'unit-ml' };
      expect(
        await firedAmount(heldIn(UnitType.Volume, 'unit-ml'), size),
      ).toEqual({ packages: { count: 1, size } });
    });

    it('adds one package nothing sizes as the API counts an add, never 1 mL', async () => {
      // A restock names one stack and refuses packages nothing sizes; a forced
      // add counts them in a counted stack.
      const create = recordMock(CreatePantryItemDocument, {
        data: { createPantryItem: null },
      });
      const restock = recordMock(RestockPantryItemDocument, {
        data: { restockPantryItem: null },
      });
      const { result } = renderHookWithApollo(
        () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
        {
          cache: heldIn(UnitType.Volume, 'unit-ml'),
          operationMocks: [create.mock, restock.mock],
        },
      );
      let restocked;
      await act(async () => {
        restocked = await result.current.restockDuplicate(SCANNED, ROW_ID);
      });

      expect(restocked).toBe(true);
      expect(restock.fired).toHaveLength(0);
      expect(create.fired[0]?.input).toMatchObject({
        item: { id: 'item-oats' },
        amount: { packages: { count: 1 } },
        forceAdd: true,
      });
    });

    it("shows the forced add's row with the catalog item a variation belongs to", async () => {
      const cache = heldIn(UnitType.Volume, 'unit-ml');
      const create = recordMock(CreatePantryItemDocument, {
        data: { createPantryItem: null },
      });
      const { result } = renderHookWithApollo(
        () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
        { cache, operationMocks: [create.mock] },
      );
      const held = new Set(Object.keys(cache.extract()));
      let row;
      await act(async () => {
        const restocked = result.current.restockDuplicate(
          { ...SCANNED, variationId: 'esm-oats' },
          ROW_ID,
        );
        // Read before the answer lands: the row is written before the create fires.
        const [minted] = Object.keys(cache.extract()).filter(
          key => key.startsWith('PantryItem:') && !held.has(key),
        );
        row = minted
          ? cache.readFragment({ id: minted, fragment: ADDED_ITEM })
          : undefined;
        await restocked;
      });

      expect(create.fired[0]?.input).toMatchObject({
        item: { variation: 'esm-oats' },
      });
      expect(row).toMatchObject({ item: { id: 'item-oats' } });
    });
  });
});
