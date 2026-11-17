import {
  inputOf,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  ErrorCode,
  StockCheckAnswer,
  StockConfidence,
} from '#/graphql/generated/schemaTypes';
import { pantryTrackingContext as context } from '#/test-utils/fixtures/pantryTrackingFixtures';
import { useStockCheck } from '../useStockCheck';
import {
  RecordPantryStockCheckDocument,
  StockToConfirmDocument,
} from '../useStockCheck.generated';

jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'P1', name: 'Kitchen' },
    currentHome: { id: 'H1' },
  }),
}));
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-11-15' }));

const stack = (id: string, version: number) => ({
  id,
  version,
  itemName: id,
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
  expect(answered).toEqual({ status: 'applied', refused: [milk] });
});
