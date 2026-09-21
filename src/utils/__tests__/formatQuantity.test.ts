import {
  formatQuantity,
  formatQuantityDisplay,
  formatQuantityAsFraction,
  formatQuantityForDisplay,
  formatQuantityForInput,
  getUnitDisplayText,
  parseStoredQuantityText,
} from '../formatQuantity';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

describe('formatQuantity', () => {
  it('formats integers without decimals', () => {
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(100)).toBe('100');
  });

  it('strips trailing zeros', () => {
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(1.1)).toBe('1.1');
  });

  it('keeps three decimal places and rounds past them', () => {
    expect(formatQuantity(0.125)).toBe('0.125');
    expect(formatQuantity(0.3333)).toBe('0.333');
    expect(formatQuantity(1.9999)).toBe('2');
    expect(formatQuantity(2.4567)).toBe('2.457');
  });

  it('handles negative numbers', () => {
    expect(formatQuantity(-1)).toBe('-1');
    expect(formatQuantity(-1.5)).toBe('-1.5');
  });
});

describe('formatQuantityDisplay', () => {
  it('formats plain quantities without unit', () => {
    expect(formatQuantityDisplay(3)).toBe('3');
    expect(formatQuantityDisplay(3, '')).toBe('3');
  });

  it('formats quantity with unit', () => {
    expect(formatQuantityDisplay(3, 'pc')).toBe('3 pc');
  });

  it('upscales grams to kilograms at 1000', () => {
    expect(formatQuantityDisplay(1500, 'g')).toBe('1.5kg');
    expect(formatQuantityDisplay(1000, 'g')).toBe('1kg');
    expect(formatQuantityDisplay(2000, 'g')).toBe('2kg');
  });

  it('keeps up to three decimals when upscaling', () => {
    expect(formatQuantityDisplay(1250, 'g')).toBe('1.25kg');
    expect(formatQuantityDisplay(1333, 'mL')).toBe('1.333L');
  });

  it('upscales milliliters to liters at 1000', () => {
    expect(formatQuantityDisplay(1500, 'ml')).toBe('1.5L');
    expect(formatQuantityDisplay(3000, 'ml')).toBe('3L');
  });

  it('does not upscale below 1000', () => {
    expect(formatQuantityDisplay(999, 'g')).toBe('999 g');
    expect(formatQuantityDisplay(500, 'ml')).toBe('500 ml');
  });

  it('writes a fractional amount as a cooking fraction', () => {
    expect(formatQuantityDisplay(1.5, 'oz')).toBe('1 1/2 oz');
    expect(formatQuantityDisplay(10.5, 'oz')).toBe('10 1/2 oz');
  });

  it('rounds a value no fraction fits to three decimals', () => {
    expect(formatQuantityDisplay(2.7, 'oz')).toBe('2.7 oz');
    expect(formatQuantityDisplay(0.07, 'oz')).toBe('0.07 oz');
    expect(formatQuantityDisplay(2.456, 'oz')).toBe('2.456 oz');
    expect(formatQuantityDisplay(177.4412, 'oz')).toBe('177.441 oz');
  });

  it('formats integers cleanly', () => {
    expect(formatQuantityDisplay(5, 'lb')).toBe('5 lb');
  });
});

describe('getUnitDisplayText', () => {
  it('prefers the symbol over the name', () => {
    expect(getUnitDisplayText({ symbol: 'g', name: 'gram' })).toBe('g');
  });

  it('falls back to the name when the symbol is blank', () => {
    expect(getUnitDisplayText({ symbol: '', name: 'pinch' })).toBe('pinch');
  });

  it('returns empty for no unit', () => {
    expect(getUnitDisplayText(null)).toBe('');
  });
});

describe('formatQuantityAsFraction', () => {
  it('returns "0" for zero', () => {
    expect(formatQuantityAsFraction(0)).toBe('0');
  });

  it('returns integer as string for whole numbers', () => {
    expect(formatQuantityAsFraction(1)).toBe('1');
    expect(formatQuantityAsFraction(10)).toBe('10');
  });

  it('formats common fractions', () => {
    expect(formatQuantityAsFraction(0.5)).toBe('1/2');
    expect(formatQuantityAsFraction(0.25)).toBe('1/4');
    expect(formatQuantityAsFraction(0.75)).toBe('3/4');
    expect(formatQuantityAsFraction(0.125)).toBe('1/8');
    expect(formatQuantityAsFraction(0.375)).toBe('3/8');
    expect(formatQuantityAsFraction(0.625)).toBe('5/8');
    expect(formatQuantityAsFraction(0.875)).toBe('7/8');
  });

  it('formats 1/3 and 2/3', () => {
    expect(formatQuantityAsFraction(1 / 3)).toBe('1/3');
    expect(formatQuantityAsFraction(2 / 3)).toBe('2/3');
  });

  it('formats mixed numbers', () => {
    expect(formatQuantityAsFraction(1.5)).toBe('1 1/2');
    expect(formatQuantityAsFraction(2.25)).toBe('2 1/4');
    expect(formatQuantityAsFraction(3.75)).toBe('3 3/4');
  });

  it('falls back to decimal for non-common fractions', () => {
    expect(formatQuantityAsFraction(2.7)).toBe('2.7');
    expect(formatQuantityAsFraction(0.07)).toBe('0.07');
  });

  it('handles tolerance-based matching for floating point', () => {
    // 0.5 + small floating-point error should still match 1/2
    expect(formatQuantityAsFraction(0.501)).toBe('1/2');
    expect(formatQuantityAsFraction(0.499)).toBe('1/2');
  });

  it('formats sixths', () => {
    expect(formatQuantityAsFraction(1 / 6)).toBe('1/6');
    expect(formatQuantityAsFraction(5 / 6)).toBe('5/6');
  });

  it('keeps a fraction improper when asked', () => {
    expect(formatQuantityAsFraction(1.5, 'fraction')).toBe('3/2');
    expect(formatQuantityAsFraction(1.5, 'decimal')).toBe('1.5');
  });
});

describe('formatQuantityForDisplay', () => {
  it('re-formats the float the API echoes back as quantityInput', () => {
    // What a recipe ingredient of 1/3 cup comes back as, stored as a float32.
    expect(
      formatQuantityForDisplay(0.33333334, { quantityInput: '0.33333334' }),
    ).toBe('1/3');
  });

  it('normalizes the number when no quantityInput was stored', () => {
    expect(formatQuantityForDisplay(0.33333334)).toBe('1/3');
    expect(formatQuantityForDisplay(0.25)).toBe('1/4');
    expect(formatQuantityForDisplay(0.125)).toBe('1/8');
    expect(formatQuantityForDisplay(2.4567)).toBe('2.457');
  });

  it("keeps the user's own notation", () => {
    expect(formatQuantityForDisplay(1.25, { quantityInput: '1 1/4' })).toBe(
      '1 1/4',
    );
  });

  it('keeps text no parser can read', () => {
    expect(formatQuantityForDisplay(null, { quantityInput: 'a pinch' })).toBe(
      'a pinch',
    );
  });

  it('is empty when there is nothing to show', () => {
    expect(formatQuantityForDisplay(null)).toBe('');
    expect(formatQuantityForDisplay(undefined, { quantityInput: '  ' })).toBe(
      '',
    );
  });

  it('keeps decimals for a unit nobody halves', () => {
    expect(formatQuantityForDisplay(0.5, { notation: 'decimal' })).toBe('0.5');
  });
});

// The set measured on device when the fraction stopped being seeded from a
// float. Every value renders exactly as it did — the fraction-vs-decimal choice
// included — which is what makes the change safe to take for the speed.
describe('the value set the fraction seeding was verified against', () => {
  it.each([
    [0.33333334, '1/3'],
    [0.66666667, '2/3'],
    [1 / 3, '1/3'],
    [0.5, '1/2'],
    [0.25, '1/4'],
    [1.25, '1 1/4'],
    [1.5, '1 1/2'],
    [0.125, '1/8'],
    [0.75, '3/4'],
    [0.16666667, '1/6'],
    [0.375, '3/8'],
    [3.33333334, '3 1/3'],
  ])('renders %p as a cooking fraction', (value, expected) => {
    expect(formatQuantityAsFraction(value)).toBe(expected);
  });

  it.each([
    [4.6, '4.6'],
    [1.1, '1.1'],
    [2.7, '2.7'],
    [0.2, '0.2'],
    [0.7, '0.7'],
    [0.93, '0.93'],
  ])('falls back to a decimal for %p', (value, expected) => {
    expect(formatQuantityAsFraction(value)).toBe(expected);
  });

  it('falls back to a decimal for a quantity too large to scale', () => {
    expect(formatQuantityAsFraction(1e12 + 0.5)).toBe(
      formatQuantity(1e12 + 0.5),
    );
  });
});

describe('parseStoredQuantityText', () => {
  afterEach(() => jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.'));

  it('reads API text with a period on a comma device', () => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    expect(parseStoredQuantityText('1.250')).toBe(1.25);
    expect(parseStoredQuantityText('1 1/4')).toBe(1.25);
    expect(parseStoredQuantityText(' 3 ')).toBe(3);
  });

  it('is null for text that is not a quantity', () => {
    expect(parseStoredQuantityText('')).toBeNull();
    expect(parseStoredQuantityText('abc')).toBeNull();
  });
});

describe('formatQuantityForInput', () => {
  afterEach(() => jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.'));

  it('seeds a cooking fraction that reads back as the same value', () => {
    expect(formatQuantityForInput(1.25)).toBe('1 1/4');
    // The API's float32 echo of a third is still a third.
    expect(formatQuantityForInput(0.33333334)).toBe('1/3');
  });

  it('keeps three decimals and rounds past them', () => {
    expect(formatQuantityForInput(2.456)).toBe('2.456');
    expect(formatQuantityForInput(177.4412)).toBe('177.441');
    // Equal to a third at three places is a third.
    expect(formatQuantityForInput(0.333)).toBe('1/3');
  });

  it('writes the device decimal separator', () => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    expect(formatQuantityForInput(2.456)).toBe('2,456');
    expect(formatQuantityForInput(1.25)).toBe('1 1/4');
  });

  it('seeds a decimal-pad field without a fraction', () => {
    expect(formatQuantityForInput(1.25, { notation: 'decimal' })).toBe('1.25');
  });

  it('seeds nothing for an absent quantity', () => {
    expect(formatQuantityForInput(null)).toBe('');
    expect(formatQuantityForInput(Number.NaN)).toBe('');
  });
});
