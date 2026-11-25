import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#apollo/cache';
import { t } from '#i18n';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  ErrorCode,
  StockCheckAnswer,
  StockConfidence,
  WasteReason,
} from '#graphql/generated/schemaTypes';
import { pantryTrackingContext as context } from '#/test-utils/fixtures/pantryTrackingFixtures';
import { useStore } from '#store';
import { useStockCheck } from '../useStockCheck';
import {
  RecordPantryStockCheckDocument,
  StockToConfirmDocument,
} from '../useStockCheck.generated';

let mockPantry = { id: 'P1', name: 'Kitchen', home: 'H1' };
jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: mockPantry.id, name: mockPantry.name },
    currentHome: { id: mockPantry.home },
  }),
}));
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-11-15' }));

const PIECE = { id: 'unit-piece', symbol: 'pc' };

const stack = (id: string, version: number) => ({
  id,
  version,
  itemName: id,
  // The unit "Some left" counts in: the stack's own.
  unit: PIECE,
  stockConfidence: { level: StockConfidence.Low, reasons: [] },
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// CHECK-01 / CHECK-03: each row goes against the version it was seen at, under
// one observation time and key; a row the server finds moved comes back.
it('sends each answer against the version seen, and hands back a stale row', async () => {
  const eggs = context.items.eggs.stackId;
  const milk = context.items.milk.stackId;
  const rows = recordMock(StockToConfirmDocument, {
    data: {
      pantry: { id: 'P1', stockToConfirm: [stack(eggs, 4), stack(milk, 7)] },
    },
  });
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: {
      recordPantryStockCheck: {
        __typename: 'RecordPantryStockCheckPayload',
        results: [
          { pantryItemId: eggs, success: true, failure: null },
          {
            pantryItemId: milk,
            success: false,
            failure: { code: ErrorCode.VersionConflict },
            pantryItem: null,
          },
        ],
      },
    },
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock, recorded.mock],
  });
  await drainTimers();
  const [eggRow, milkRow] = result.current.rows;
  expect(eggRow && milkRow).toBeTruthy();

  const answered = await drained(() =>
    result.current.answer([
      {
        row: eggRow!,
        choice: { answer: StockCheckAnswer.SomeLeft, quantity: 6 },
      },
      { row: milkRow!, choice: { answer: StockCheckAnswer.UsedUp } },
    ]),
  );

  expect(inputOf(recorded.fired[0]!)).toMatchObject({
    pantryId: 'P1',
    checkedAt: expect.any(String),
    idempotencyKey: expect.any(String),
    entries: [
      {
        pantryItemId: eggs,
        answer: 'SOME_LEFT',
        expectedVersion: 4,
        quantity: 6,
      },
      { pantryItemId: milk, answer: 'USED_UP', expectedVersion: 7 },
    ],
  });
  expect(answered).toEqual({
    status: 'applied',
    refused: [
      {
        pantryItemId: milk,
        message: t('pantryScreen.stockCheckStale'),
        field: expect.anything(),
      },
    ],
  });
});

// CHECK-02: what was thrown out is recorded as waste for the reason picked.
it('sends Threw out with the reason picked', async () => {
  const eggs = context.items.eggs.stackId;
  const rows = recordMock(StockToConfirmDocument, {
    data: { pantry: { id: 'P1', stockToConfirm: [stack(eggs, 4)] } },
  });
  const recorded = recordMock(RecordPantryStockCheckDocument, {
    data: { recordPantryStockCheck: null },
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock, recorded.mock],
  });
  await drainTimers();
  const [eggRow] = result.current.rows;

  await drained(() =>
    result.current.answer([
      {
        row: eggRow!,
        choice: { answer: StockCheckAnswer.ThrewOut, reason: WasteReason.Mold },
      },
    ]),
  );

  expect(inputOf(recorded.fired[0]!)).toMatchObject({
    entries: [{ pantryItemId: eggs, answer: 'THREW_OUT', wasteReason: 'MOLD' }],
  });
});

// CHECK-04: a carton found holding 40 of its 64 fl oz reads so at once, as
// the server will record it: one carton, 40 fl oz left in it.
it('shows a partial package as found while the check is queued', async () => {
  const milk = context.items.milk.stackId;
  const floz = { id: 'unit-floz', symbol: 'fl oz' };
  const cache = makeCache();
  const rows = recordMock(StockToConfirmDocument, {
    data: {
      pantry: {
        id: 'P1',
        stockToConfirm: [
          {
            ...stack(milk, 3),
            unit: { id: 'unit-carton', symbol: 'carton' },
            packageSize: { value: 64, unitId: floz.id },
            netWeightUnit: floz,
          },
        ],
      },
    },
  });
  const queued = recordMock(RecordPantryStockCheckDocument, {
    data: { recordPantryStockCheck: null },
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock, queued.mock],
    cache,
  });
  await drainTimers();
  const [milkRow] = result.current.rows;
  expect(milkRow?.contents).toEqual({
    unitId: floz.id,
    unitSymbol: 'fl oz',
  });

  await drained(() =>
    result.current.answer([
      {
        row: milkRow!,
        choice: {
          answer: StockCheckAnswer.SomeLeft,
          quantity: 1,
          contents: { amount: 40, unitId: floz.id },
        },
      },
    ]),
  );

  expect(inputOf(queued.fired[0]!)).toMatchObject({
    entries: [
      {
        quantity: 1,
        remainingNetWeight: 40,
        remainingNetWeightUnitId: floz.id,
      },
    ],
  });
  expect(
    cache.extract(true)[
      cache.identify({ __typename: 'PantryItem', id: milk })!
    ],
  ).toMatchObject({ quantity: 1, remainingNetWeight: 40 });
});

// A check moves the list it came from: the server's answer restates it, and
// before then a row the check emptied leaves, as no empty stack is checked.
describe('what is left to check after an answer', () => {
  const eggs = context.items.eggs.stackId;
  const milk = context.items.milk.stackId;
  const twoRows = () =>
    recordMock(StockToConfirmDocument, {
      data: {
        pantry: { id: 'P1', stockToConfirm: [stack(eggs, 4), stack(milk, 7)] },
      },
    });
  const useUpEggs = async (result: {
    current: ReturnType<typeof useStockCheck>;
  }) => {
    const [eggRow] = result.current.rows;
    expect(eggRow?.id).toBe(eggs);
    await drained(() =>
      result.current.answer([
        { row: eggRow!, choice: { answer: StockCheckAnswer.UsedUp } },
      ]),
    );
  };

  it("is the server's list once it answers", async () => {
    const recorded = recordMock(RecordPantryStockCheckDocument, {
      data: {
        recordPantryStockCheck: {
          __typename: 'RecordPantryStockCheckPayload',
          pantry: { id: 'P1', stockToConfirm: [stack(milk, 7)] },
          results: [{ pantryItemId: eggs, success: true, failure: null }],
        },
      },
    });
    const { result } = renderHookWithApollo(() => useStockCheck(), {
      operationMocks: [twoRows().mock, recorded.mock],
    });
    await drainTimers();

    await useUpEggs(result);

    expect(result.current.rows.map(row => row.id)).toEqual([milk]);
  });

  it('drops a row the check emptied while the write is queued', async () => {
    const queued = recordMock(RecordPantryStockCheckDocument, {
      data: { recordPantryStockCheck: null },
    });
    const { result } = renderHookWithApollo(() => useStockCheck(), {
      operationMocks: [twoRows().mock, queued.mock],
    });
    await drainTimers();

    await useUpEggs(result);

    expect(result.current.rows.map(row => row.id)).toEqual([milk]);
  });
});

// 4.4: evidence the device does not hold is never stated as a level or a list.
it('reads a stack with no confidence answer as unknown, never HIGH', async () => {
  const rows = recordMock(StockToConfirmDocument, {
    data: {
      pantry: {
        id: 'P1',
        stockToConfirm: [{ ...stack('eggs', 1), stockConfidence: null }],
      },
    },
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock],
  });
  await drainTimers();

  expect(result.current.rows).toEqual([
    expect.objectContaining({ id: 'eggs', level: null, reasons: [] }),
  ]);
});

// Confidence is for a day: the device's answer from an earlier one is not today's.
it("reads an earlier day's confidence as unknown until today's answer arrives", async () => {
  useStore.setState({ isOnline: false, apiReachable: false });
  const cache = makeCache();
  seedQuery(cache, {
    query: StockToConfirmDocument,
    variables: { pantryId: 'P1', today: '2026-11-14' },
    data: {
      pantry: {
        id: 'P1',
        stockToConfirm: [
          {
            ...stack('eggs', 1),
            stockConfidence: {
              level: StockConfidence.Low,
              reasons: [],
              lastConfirmedAt: '2026-11-01T09:00:00.000Z',
            },
          },
        ],
      },
    },
  });
  // Offline the device answers from what it holds, as the offline link does.
  const rows = recordMock(StockToConfirmDocument, {
    data: cache.readQuery({
      query: StockToConfirmDocument,
      variables: { pantryId: 'P1', today: '2026-11-15' },
    }),
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock],
    cache,
  });
  await drainTimers();

  expect(result.current.rows).toEqual([
    expect.objectContaining({
      id: 'eggs',
      level: null,
      reasons: [],
      lastConfirmedAt: null,
    }),
  ]);
  useStore.setState({ isOnline: true, apiReachable: true });
});

// REL-03: another home's check is never this one's, however alike its stacks.
it("shows no other pantry's check after a switch, while this one's is read", async () => {
  mockPantry = { id: 'P1', name: 'Kitchen', home: 'H1' };
  const p1 = recordMock(StockToConfirmDocument, {
    data: { pantry: { id: 'P1', stockToConfirm: [stack('P1-eggs', 2)] } },
    match: vars => vars.pantryId === 'P1',
  });
  const p2 = recordMock(StockToConfirmDocument, {
    held: true,
    match: vars => vars.pantryId === 'P2',
  });
  const { result, rerender } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [p1.mock, p2.mock],
  });
  await drainTimers();
  expect(result.current.rows.map(row => row.id)).toEqual(['P1-eggs']);

  mockPantry = { id: 'P2', name: 'Cabin', home: 'H2' };
  rerender({});
  await drainTimers();

  expect(p2.fired[0]).toMatchObject({ pantryId: 'P2' });
  expect(result.current.rows).toEqual([]);
  mockPantry = { id: 'P1', name: 'Kitchen', home: 'H1' };
});

it('is offline, never an empty check, when the device holds no answer', async () => {
  useStore.setState({ isOnline: false, apiReachable: false });
  const rows = recordMock(StockToConfirmDocument, {
    error: new Error('Network request failed'),
  });
  const { result } = renderHookWithApollo(() => useStockCheck(), {
    operationMocks: [rows.mock],
  });
  await drainTimers();

  expect(result.current.rows).toEqual([]);
  expect(result.current.state).toBe('offline');
  useStore.setState({ isOnline: true, apiReachable: true });
});
