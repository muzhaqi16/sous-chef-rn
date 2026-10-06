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
jest.mock('#features/shoppingList/hooks/useMoveToPantry', () => ({
  useMoveToPantry: () => ({ moveToPantry: jest.fn() }),
}));

const line = (index: number, itemName: string): ReceiptApplyLine => ({
  index,
  choice: lineChoice({ itemId: `cat-${index}`, itemName, price: 2.5 }),
});

beforeEach(() => {
  mockAddItem.mockReset();
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
});
