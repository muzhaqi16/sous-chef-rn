import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { ScanAmount, ScannedItem } from '../../types';
import { useAddScannedItem } from '../useAddScannedItem';

// What a restock moves and sends is `usePantryRestock`'s suite; this one holds
// what the scan hands it.

const ROW_ID = 'pi-oats';

const SCANNED: ScannedItem = {
  id: 'item-oats',
  conceptIds: [],
  name: 'Oats',
  upc: '0001',
  canEdit: false,
  canSuggest: true,
};

/** One package counted in a piece, as a scan states it. */
const ONE_PACKAGE = {
  packaged: true,
  count: 1,
  unitId: 'unit-pc',
  size: null,
} as const satisfies ScanAmount;

const ADDED_ITEM = gql`
  fragment _RestockAddedItemProbe on PantryItem {
    id
    item {
      id
    }
  }
`;

/** A cache holding the duplicated row, stacked in `unitId`. */
const heldIn = (type: UnitType, unitId: string) => {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: gql`
      fragment _RestockStackUnit on PantryItem {
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
      quantity: 3,
      unit: { __typename: 'Unit', id: unitId, type, symbol: unitId },
    },
  });
  return cache;
};

/** The amount the one write recorded sent. */
const amountSent = (mock: ReturnType<typeof recordMock>) =>
  (mock.fired[0] as { input: { amount: unknown } } | undefined)?.input.amount;

const renderScan = (
  cache: ReturnType<typeof makeCache>,
  mock: ReturnType<typeof recordMock>,
) =>
  renderHookWithApollo(
    () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
    { cache, operationMocks: [mock.mock] },
  );

describe('restocking the row a scan duplicated', () => {
  // A stack held by volume refuses a package unit: the size is what lands.
  it('restocks one package of the size entered, naming no unit', async () => {
    const restock = recordMock(RestockPantryItemDocument, {
      data: { restockPantryItem: null },
    });
    const { result } = renderScan(heldIn(UnitType.Volume, 'unit-ml'), restock);
    const size = { netWeight: 500, netWeightUnitId: 'unit-ml' };

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID, {
        ...ONE_PACKAGE,
        size,
      });
    });

    expect(restock.fired[0]?.input).toMatchObject({ id: ROW_ID });
    expect(amountSent(restock)).toStrictEqual({
      packages: { count: 1, size },
    });
  });

  it.each([
    [
      'sized',
      { netWeight: 400, netWeightUnitId: 'unit-g' },
      {
        packages: {
          count: 2,
          size: { netWeight: 400, netWeightUnitId: 'unit-g' },
          unitId: 'unit-jar',
        },
      },
    ],
    ['unsized', null, { measured: { quantity: 2, unitId: 'unit-jar' } }],
  ])(
    'restocks a counted stack by the %s packages in the unit picked',
    async (_label, size, amount) => {
      const restock = recordMock(RestockPantryItemDocument, {
        data: { restockPantryItem: null },
      });
      const { result } = renderScan(heldIn(UnitType.Count, 'unit-pc'), restock);

      await act(async () => {
        await result.current.restockDuplicate(SCANNED, ROW_ID, {
          packaged: true,
          count: 2,
          unitId: 'unit-jar',
          size,
        });
      });

      expect(amountSent(restock)).toStrictEqual(amount);
    },
  );

  // A forced add, since a restock refuses packages nothing sizes.
  it.each([
    ['a catalog item', SCANNED, { id: 'item-oats' }],
    [
      'a variation',
      { ...SCANNED, variationId: 'esm-oats' },
      { variation: 'esm-oats' },
    ],
  ])(
    'adds a package nothing sizes as %s in the unit picked, its row showing the catalog item',
    async (_label, scanned, sent) => {
      const cache = heldIn(UnitType.Volume, 'unit-ml');
      const create = recordMock(CreatePantryItemDocument, {
        data: { createPantryItem: null },
      });
      const { result } = renderScan(cache, create);
      const held = new Set(Object.keys(cache.extract()));
      let row;
      let restocked;
      await act(async () => {
        const pending = result.current.restockDuplicate(
          scanned,
          ROW_ID,
          ONE_PACKAGE,
        );
        // Read before the answer lands: the row is written before the create fires.
        const [minted] = Object.keys(cache.extract()).filter(
          key => key.startsWith('PantryItem:') && !held.has(key),
        );
        row = minted
          ? cache.readFragment({ id: minted, fragment: ADDED_ITEM })
          : undefined;
        restocked = await pending;
      });

      expect(restocked).toBe(true);
      expect(create.fired[0]?.input).toMatchObject({
        item: sent,
        amount: { packages: { count: 1, unitId: 'unit-pc' } },
        forceAdd: true,
      });
      expect(row).toMatchObject({ item: { id: 'item-oats' } });
    },
  );

  it('restocks a measured amount as stated', async () => {
    const restock = recordMock(RestockPantryItemDocument, {
      data: { restockPantryItem: null },
    });
    const { result } = renderScan(heldIn(UnitType.Volume, 'unit-ml'), restock);

    await act(async () => {
      await result.current.restockDuplicate(SCANNED, ROW_ID, {
        packaged: false,
        quantity: 750,
        unitId: 'unit-ml',
      });
    });

    expect(restock.fired[0]?.input).toMatchObject({
      id: ROW_ID,
      amount: { measured: { quantity: 750, unitId: 'unit-ml' } },
    });
  });
});
