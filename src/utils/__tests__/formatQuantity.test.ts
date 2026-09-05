import {
  formatQuantity,
  formatQuantityDisplay,
  formatQuantityAsFraction,
  formatQuantityForDisplay,
} from '../formatQuantity';

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

  it('rounds to 2 decimal places', () => {
    expect(formatQuantity(0.333)).toBe('0.33');
    expect(formatQuantity(1.999)).toBe('2');
    expect(formatQuantity(2.456)).toBe('2.46');
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
    expect(formatQuantityDisplay(1000, 'g')).toBe('1.0kg');
    expect(formatQuantityDisplay(2000, 'g')).toBe('2.0kg');
  });

  it('upscales milliliters to liters at 1000', () => {
    expect(formatQuantityDisplay(1500, 'ml')).toBe('1.5L');
    expect(formatQuantityDisplay(3000, 'ml')).toBe('3.0L');
  });

  it('does not upscale below 1000', () => {
    expect(formatQuantityDisplay(999, 'g')).toBe('999 g');
    expect(formatQuantityDisplay(500, 'ml')).toBe('500 ml');
  });

  it('writes a fractional amount as a cooking fraction', () => {
    expect(formatQuantityDisplay(1.5, 'oz')).toBe('1 1/2 oz');
    expect(formatQuantityDisplay(10.5, 'oz')).toBe('10 1/2 oz');
  });

  it('trims a value no fraction fits to 2 decimals', () => {
    expect(formatQuantityDisplay(2.7, 'oz')).toBe('2.7 oz');
    expect(formatQuantityDisplay(0.07, 'oz')).toBe('0.07 oz');
  });

  it('formats integers cleanly', () => {
    expect(formatQuantityDisplay(5, 'lb')).toBe('5 lb');
  });
});

describe('formatQuantityAsFraction', () => {
  it('returns "0" for null/undefined/zero', () => {
    expect(
      (formatQuantityAsFraction as (qty: number | null) => string)(null),
    ).toBe('0');
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
    expect(formatQuantityForDisplay(2.456)).toBe('2.46');
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
