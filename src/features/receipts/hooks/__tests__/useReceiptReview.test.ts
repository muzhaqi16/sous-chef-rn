'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import { usePantryItemSelection } from '#features/pantry/hooks/usePantryItemSelection';
import {
  GetShoppingListItemsFilteredDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useStore } from '#store';
import { AcquisitionMethod, ErrorCode } from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import {
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../../store/receiptDraftStore';
import { useReceiptReview } from '../useReceiptReview';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({ pantry: { id: 'p1', name: 'Kitchen' } }),
}));
jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

globalThis.requestIdleCallback = jest.fn((cb: IdleRequestCallback) => {
  cb({ didTimeout: false, timeRemaining: () => 0 });
  return 1;
});
globalThis.cancelIdleCallback = jest.fn();

const PANTRY_VARS = { id: 'p1', itemsFirst: 100 };
const PANTRY: MockDataFor<typeof GetPantryDocument> = {
  pantry: {
    __typename: 'Pantry',
    id: 'p1',
    stats: { totalItems: 0 },
    itemsConnection: {
      totalCount: 0,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: [],
    },
  },
};

const MILK: ReceiptLineChoice = {
  itemId: 'cat-milk',
  itemName: 'Whole milk',
  quantity: 1,
  unitId: null,
  unitText: '',
  price: 2.79,
};
const BANANAS: ReceiptLineChoice = {
  itemId: null,
  itemName: 'Bananas',
  quantity: 2.14,
  unitId: null,
  unitText: 'lb',
  price: 1.26,
};

const seedDraft = () =>
  useReceiptDraftStore.setState({
    draft: {
      pages: ['KROGER'],
      scannedAt: '2026-09-30T10:00:00.000Z',
      parsed: {
        merchant: 'KROGER',
        lines: [
          { index: 0, rawText: 'KROGER', kind: 'other' },
          {
            index: 1,
            rawText: 'KRO WHL MILK 3.29',
            kind: 'item',
            product: 'KRO WHL MILK',
            lineTotal: 3.29,
          },
          {
            index: 2,
            rawText: 'SC KROGER SAVINGS 0.50-',
            kind: 'discount',
            lineTotal: -0.5,
            appliesToIndex: 1,
          },
          {
            index: 3,
            rawText: 'BANANAS',
            kind: 'item',
            product: 'BANANAS',
            quantity: 2.14,
            unit: 'lb',
            lineTotal: 1.26,
          },
          { index: 4, rawText: 'BALANCE 4.05', kind: 'total', lineTotal: 4.05 },
        ],
      },
    },
  });

function pantryItemNames(cache: ReturnType<typeof makeCache>) {
  const pantry = cache.readQuery<Unmasked<GetPantryQuery>>({
    query: GetPantryDocument,
    variables: PANTRY_VARS,
  })?.pantry;
  return pantry?.itemsConnection.edges.map(edge => edge.node.itemName) ?? [];
}

// The catalog item is created; the typed one is refused.
const createFor = (
  vars: Record<string, unknown>,
): MockDataFor<typeof CreatePantryItemDocument> => {
  const input = isRecord(vars.input) ? vars.input : {};
  const item = isRecord(input.item) ? input.item : {};
  return item.id
    ? {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: {
            id: String(input.id),
            itemName: 'Whole milk',
            item: { id: 'cat-milk' },
          },
          pantry: { id: 'p1', stats: { totalItems: 1 } },
        },
      }
    : {
        createPantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'item',
        },
      };
};

// Milk is open on the active list; nothing has been bought from it yet.
const listItems = (
  vars: Record<string, unknown>,
): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => ({
  shoppingList: {
    __typename: 'ShoppingList',
    id: 'list-1',
    itemsConnection: {
      totalCount: vars.isPurchased ? 0 : 1,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: vars.isPurchased
        ? []
        : [
            {
              cursor: 'c1',
              node: {
                id: 'sli-milk',
                itemName: 'Milk',
                quantity: 2,
                unit: null,
                item: { id: 'cat-milk' },
                shoppingList: { id: 'list-1' },
                purchaseInfo: { isPurchased: false, movedToPantryAt: null },
              },
            },
          ],
    },
  },
});

const movedFor = (
  vars: Record<string, unknown>,
): MockDataFor<typeof MoveShoppingItemToPantryDocument> => {
  const input = isRecord(vars.input) ? vars.input : {};
  return {
    moveShoppingItemToPantry: {
      __typename: 'MoveShoppingItemToPantryPayload',
      pantryItem: { id: String(input.pantryItemId) },
    },
  };
};

async function setup() {
  const cache = makeCache();
  const getPantry = recordMock(GetPantryDocument, { data: PANTRY });
  const create = recordMock(CreatePantryItemDocument, { dataFor: createFor });
  const list = recordMock(GetShoppingListItemsFilteredDocument, {
    dataFor: listItems,
  });
  const move = recordMock(MoveShoppingItemToPantryDocument, {
    dataFor: movedFor,
  });
  const rendered = renderHookWithApollo(
    () => {
      const pantry = usePantryItemSelection('p1');
      return { pantry, review: useReceiptReview() };
    },
    {
      cache,
      operationMocks: [getPantry.mock, create.mock, list.mock, move.mock],
    },
  );
  await waitFor(() =>
    expect(rendered.result.current.pantry.hasLoaded).toBe(true),
  );
  return { ...rendered, cache, create, move };
}

beforeEach(() => {
  jest.clearAllMocks();
  seedDraft();
});

describe('useReceiptReview', () => {
  it('lists the item lines priced after their discounts, none chosen yet', async () => {
    const { result } = await setup();

    const { rows, merchant, pendingCount } = result.current.review;
    expect(merchant).toBe('KROGER');
    expect(rows.map(row => [row.printed, row.price, row.added])).toEqual([
      ['KRO WHL MILK', 2.79, false],
      ['BANANAS', 1.26, false],
    ]);
    expect(pendingCount).toBe(0);
  });

  it('adds the chosen lines, keeps what was added, and names why the rest failed', async () => {
    const { result, cache, create } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
      result.current.review.chooseLine(3, BANANAS);
    });
    expect(result.current.review.pendingCount).toBe(2);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.review.addChosen();
    });

    expect(outcome).toEqual({ added: 1, failed: 1 });
    expect(create.fired.map(vars => vars.input)).toEqual([
      expect.objectContaining({
        item: { id: 'cat-milk' },
        forceAdd: true,
        purchase: {
          acquisitionMethod: AcquisitionMethod.Purchased,
          totalCost: 2.79,
        },
      }),
      expect.objectContaining({
        item: { inline: { name: 'Bananas' } },
        quantity: 2.14,
        unit: { name: 'lb' },
        forceAdd: true,
      }),
    ]);
    // A bare 1 with no unit is the API's to default, so none is sent.
    expect(create.fired[0]?.input).toEqual(
      expect.not.objectContaining({ quantity: expect.anything() }),
    );
    expect(pantryItemNames(cache)).toEqual(['Whole milk']);

    const [milk, bananas] = result.current.review.rows;
    expect(milk?.added).toBe(true);
    expect(bananas?.added).toBe(false);
    expect(bananas?.failure).toEqual(expect.any(String));
    // A retry sends only the line that failed.
    expect(result.current.review.pendingCount).toBe(1);
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([1]);
  });

  it('forgets a line the user chose not to add', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.review.chooseLine(1, MILK);
    });
    await act(async () => {
      result.current.review.chooseLine(1, null);
    });

    expect(result.current.review.rows[0]?.choice).toBeUndefined();
    expect(result.current.review.pendingCount).toBe(0);
  });

  describe('with the milk open on the shopping list', () => {
    beforeEach(() => {
      useStore.getState().setSelectedShoppingListId('list-1');
    });
    afterEach(() => {
      useStore.getState().setSelectedShoppingListId(null);
    });

    it('ticks the list line off instead of adding the milk again', async () => {
      const { result, create, move } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, MILK);
        result.current.review.chooseLine(3, {
          ...BANANAS,
          itemId: 'cat-bananas',
        });
      });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.onList).toBe(true),
      );
      expect(result.current.review.rows[0]?.listItemName).toBe('Milk');
      expect(result.current.review.rows[1]?.onList).toBe(false);

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.review.addChosen();
      });

      expect(outcome).toEqual({ added: 2, failed: 0 });
      // The amount and price the review shows, whatever the list asked for.
      expect(move.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({
          shoppingListItemId: 'sli-milk',
          pantryId: 'p1',
          actualQuantity: 1,
          actualPrice: 2.79,
          removeFromList: true,
        }),
      ]);
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({ item: { id: 'cat-bananas' } }),
      ]);
    });

    it('adds a line on its own when the user keeps it off the list', async () => {
      const { result, create, move } = await setup();
      await act(async () => {
        result.current.review.chooseLine(1, { ...MILK, offList: true });
      });
      await waitFor(() =>
        expect(result.current.review.rows[0]?.listItemName).toBe('Milk'),
      );
      expect(result.current.review.rows[0]?.onList).toBe(false);

      await act(async () => {
        await result.current.review.addChosen();
      });

      expect(move.fired).toEqual([]);
      expect(create.fired.map(vars => vars.input)).toEqual([
        expect.objectContaining({ item: { id: 'cat-milk' } }),
      ]);
    });
  });
});
