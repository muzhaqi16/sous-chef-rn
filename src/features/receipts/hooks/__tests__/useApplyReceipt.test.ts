import { act, renderHook } from '@testing-library/react-native';
import { errorService } from '#/services/errorService';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useApplyReceipt, type ReceiptApplyLine } from '../useApplyReceipt';
import { lineChoice, seedDraft } from '../../__tests__/helpers/receiptFixtures';

jest.mock('#/services/errorService');

const mockAddItem = jest.fn();
jest.mock('#features/pantry/hooks/usePantryIntake', () => ({
  usePantryIntake: () => ({ addItem: mockAddItem, heldUnitOf: () => null }),
}));
jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({ pantry: { id: 'p1', name: 'Kitchen' } }),
}));
const mockMoveToPantry = jest.fn();
jest.mock('#features/shoppingList/hooks/useMoveToPantry', () => ({
  useMoveToPantry: () => ({ moveToPantry: mockMoveToPantry }),
}));

const line = (index: number, itemName: string): ReceiptApplyLine => ({
  index,
  choice: lineChoice({ itemId: `cat-${index}`, itemName, price: 2.5 }),
});

/** An open list line of two pounds of the item. */
const listLine = {
  id: 'line-1',
  quantity: 2,
  unit: { id: 'unit-lb', name: 'pound', symbol: 'lb' },
  item: { id: 'cat-1' },
} as unknown as NonNullable<ReceiptApplyLine['listLine']>;

beforeEach(() => {
  mockAddItem.mockReset();
  mockMoveToPantry.mockReset();
  mockMoveToPantry.mockResolvedValue({ status: 'moved' });
  seedDraft();
});

describe('useApplyReceipt', () => {
  // An unexpected throw (a cache write outside a guard) must neither leave the
  // review spinning nor leave the lines already written unmarked for a retry.
  it('fails only the line whose write throws, and always finishes', async () => {
    mockAddItem
      .mockRejectedValueOnce(new Error('cache write failed'))
      .mockResolvedValueOnce({ status: 'added' });
    const { result } = renderHook(() => useApplyReceipt(undefined));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.apply([line(1, 'Milk'), line(2, 'Eggs')], {
        purchasedOn: '2026-09-30',
      });
    });

    expect(outcome).toEqual({ addedIndexes: [2], failed: 1 });
    expect(result.current.applying).toBe(false);
    expect(result.current.failures).toEqual([
      { index: 1, reason: expect.any(String) },
    ]);
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([2]);
    expect(errorService.reportError).toHaveBeenCalledTimes(1);
  });

  // Left unstated, the API records one of the item's tracking unit: a block of
  // cheese as 1 g, observed at its total per gram.
  it.each([1, 2])(
    'adds %i bought with no unit as that many packages',
    async count => {
      mockAddItem.mockResolvedValue({ status: 'added' });
      const { result } = renderHook(() => useApplyReceipt(undefined));

      await act(async () => {
        await result.current.apply(
          [
            {
              index: 1,
              choice: lineChoice({
                itemId: 'cat-1',
                quantity: count,
                price: 4.41,
              }),
            },
          ],
          { purchasedOn: '2026-10-15' },
        );
      });

      const [[, input]] = mockAddItem.mock.calls;
      expect(input).toMatchObject({
        amount: { packages: { count } },
        purchase: expect.objectContaining({ totalCost: 4.41 }),
      });
      expect(input).not.toHaveProperty('quantity');
    },
  );

  describe('a line off the list, in a unit the receipt does not name', () => {
    const applyOff = async (quantity: number) => {
      const { result } = renderHook(() => useApplyReceipt('list-1'));
      await act(async () => {
        await result.current.apply(
          [
            {
              index: 1,
              choice: lineChoice({ itemId: 'cat-1', quantity }),
              listLine,
            },
          ],
          { purchasedOn: '2026-09-30' },
        );
      });
      return result;
    };

    it("records the list's amount for a bare 1", async () => {
      await applyOff(1);

      expect(mockMoveToPantry).toHaveBeenCalledWith(
        listLine,
        expect.objectContaining({
          amount: { measured: { quantity: 2, unitId: 'unit-lb' } },
        }),
      );
    });

    it('records a printed count as that many packages', async () => {
      await applyOff(3);

      expect(mockMoveToPantry).toHaveBeenCalledWith(
        listLine,
        expect.objectContaining({ amount: { packages: { count: 3 } } }),
      );
    });

    // 0.5 of something is not the two pounds the list planned.
    it("asks for a unit rather than record the list's amount for a part", async () => {
      const result = await applyOff(0.5);

      expect(mockMoveToPantry).not.toHaveBeenCalled();
      expect(result.current.failures).toEqual([
        { index: 1, reason: expect.any(String) },
      ]);
    });
  });
});
