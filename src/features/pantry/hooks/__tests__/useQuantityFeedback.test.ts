import { renderHook } from '@testing-library/react-native';
import {
  eggsShared,
  pantryActionShared,
} from '#/test-utils/pantryActionShared';
import { useQuantityFeedback } from '../useQuantityFeedback';

/** What the API converts the typed amount to, in the net-weight unit. */
let mockConvertedValue: number | null = null;
jest.mock('../useConversionPreview', () => ({
  useConversionPreview: () => ({
    previewText: null,
    previewLoading: false,
    convertedValue: mockConvertedValue,
    confidence: null,
  }),
}));

afterEach(() => {
  mockConvertedValue = null;
});

const feedback = (
  input: number | null,
  shared: ReturnType<typeof pantryActionShared>,
) => {
  const { result } = renderHook(() => useQuantityFeedback(input, shared));
  const { remaining, available } = result.current;
  return {
    remaining: remaining && `${remaining.quantity} ${remaining.unit.symbol}`,
    available: available && `${available.quantity} ${available.unit.symbol}`,
  };
};

describe('useQuantityFeedback', () => {
  it('subtracts in the tracking unit', () => {
    expect(feedback(0.5, pantryActionShared(2))).toEqual({
      remaining: '1.5 cup',
      available: '2 cup',
    });
  });

  describe('on a stack of pieces shown in dozens', () => {
    it('reads what is left in pieces when it is no common fraction of a dozen', () => {
      expect(feedback(25, eggsShared(36, 'pc'))).toEqual({
        remaining: '11 pc',
        available: '3 doz',
      });
    });

    it('reads what is left in dozens when it is a common fraction of one', () => {
      expect(feedback(4, eggsShared(36, 'pc')).remaining).toBe(
        `${32 / 12} doz`,
      );
    });

    it('reads an amount typed in dozens by the pieces it names', () => {
      expect(feedback(1, eggsShared(36, 'doz')).remaining).toBe('2 doz');
      // ⅓ doz typed to three decimals is 4 eggs, as the server reads it.
      expect(feedback(0.333, eggsShared(36, 'doz')).remaining).toBe(
        `${32 / 12} doz`,
      );
      expect(feedback(2 + 1 / 12, eggsShared(36, 'doz')).remaining).toBe(
        '11 pc',
      );
    });

    it('reads the whole stock typed in dozens as none left', () => {
      expect(feedback(0.917, eggsShared(11, 'doz')).remaining).toBe('0 pc');
    });

    it('goes below zero past the stock, against what is available', () => {
      expect(feedback(1, eggsShared(11, 'doz'))).toEqual({
        remaining: '-1 pc',
        available: '11 pc',
      });
    });
  });

  describe('on a pack of 10 cans that states 2000 mL', () => {
    const PACK_ML = 2000;
    const pack = (packagesOfNetWeight: (ml: number) => number | null) =>
      pantryActionShared(1, {
        activeUnit: { symbol: 'can' },
        activeUnitId: 'can',
        isConvertedUnit: true,
        exactFactor: null,
        isDualTracked: true,
        remainingNetWeight: PACK_ML,
        netWeightUnit: { symbol: 'mL' },
        netWeightUnitId: 'ml',
        packagesOfNetWeight,
        // The row reads an opened pack by the can.
        leftAfter: drawn => ({
          quantity: Math.round((1 - drawn) * 10 * 1000) / 1000,
          unit: { symbol: 'cans' },
          displayAsFraction: null,
        }),
      });

    it('reads what a can leaves by the can, as the row will', () => {
      mockConvertedValue = 200;

      expect(
        feedback(
          1,
          pack(ml => ml / PACK_ML),
        ).remaining,
      ).toBe('9 cans');
    });

    it('stays in the net-weight unit with no package size to count by', () => {
      mockConvertedValue = 200;

      expect(
        feedback(
          1,
          pack(() => null),
        ).remaining,
      ).toBe('1800 mL');
    });
  });
});
