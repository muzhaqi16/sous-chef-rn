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

async function setup() {
  const cache = makeCache();
  const getPantry = recordMock(GetPantryDocument, { data: PANTRY });
  const create = recordMock(CreatePantryItemDocument, { dataFor: createFor });
  const rendered = renderHookWithApollo(
    () => {
      const pantry = usePantryItemSelection('p1');
      return { pantry, review: useReceiptReview() };
    },
    { cache, operationMocks: [getPantry.mock, create.mock] },
  );
  await waitFor(() =>
    expect(rendered.result.current.pantry.hasLoaded).toBe(true),
  );
  return { ...rendered, cache, create };
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
    act(() => {
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
    act(() => result.current.review.chooseLine(1, MILK));
    act(() => result.current.review.chooseLine(1, null));

    expect(result.current.review.rows[0]?.choice).toBeUndefined();
    expect(result.current.review.pendingCount).toBe(0);
  });
});
