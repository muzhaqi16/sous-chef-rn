import {
  formatAmountDisplay,
  formatAmountWithUnit,
  formatQuantity,
  formatQuantityDisplay,
  formatQuantityAsFraction,
  formatQuantityForDisplay,
  formatQuantityForInput,
  formatQuantityWithUnit,
  statedAmount,
  formatNetWeightDisplay,
  parseStoredQuantityText,
  unitLabel,
} from '../formatQuantity';
import { getI18n } from '#/i18n/config';
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
    expect(formatQuantityDisplay(3, { symbol: '' })).toBe('3');
  });

  it('formats quantity with unit', () => {
    expect(formatQuantityDisplay(3, { symbol: 'pc' })).toBe('3 pc');
  });

  it('upscales grams to kilograms at 1000', () => {
    expect(formatQuantityDisplay(1500, { symbol: 'g' })).toBe('1.5 kg');
    expect(formatQuantityDisplay(1000, { symbol: 'g' })).toBe('1 kg');
    expect(formatQuantityDisplay(2000, { symbol: 'g' })).toBe('2 kg');
  });

  it('keeps up to three decimals when upscaling', () => {
    expect(formatQuantityDisplay(1250, { symbol: 'g' })).toBe('1.25 kg');
    expect(formatQuantityDisplay(1333, { symbol: 'mL' })).toBe('1.333 L');
  });

  it('upscales milliliters to liters at 1000', () => {
    expect(formatQuantityDisplay(1500, { symbol: 'ml' })).toBe('1.5 L');
    expect(formatQuantityDisplay(3000, { symbol: 'ml' })).toBe('3 L');
  });

  it('does not upscale below 1000', () => {
    expect(formatQuantityDisplay(999, { symbol: 'g' })).toBe('999 g');
    expect(formatQuantityDisplay(500, { symbol: 'ml' })).toBe('500 ml');
  });

  it('writes a fractional amount as a cooking fraction', () => {
    expect(formatQuantityDisplay(1.5, { symbol: 'oz' })).toBe('1 1/2 oz');
    expect(formatQuantityDisplay(10.5, { symbol: 'oz' })).toBe('10 1/2 oz');
  });

  it('rounds a value no fraction fits to three decimals', () => {
    expect(formatQuantityDisplay(2.7, { symbol: 'oz' })).toBe('2.7 oz');
    expect(formatQuantityDisplay(0.07, { symbol: 'oz' })).toBe('0.07 oz');
    expect(formatQuantityDisplay(2.456, { symbol: 'oz' })).toBe('2.456 oz');
    expect(formatQuantityDisplay(177.4412, { symbol: 'oz' })).toBe(
      '177.441 oz',
    );
  });

  it('formats integers cleanly', () => {
    expect(formatQuantityDisplay(5, { symbol: 'lb' })).toBe('5 lb');
  });
});

describe('formatNetWeightDisplay', () => {
  it('returns null for no weight', () => {
    expect(formatNetWeightDisplay(null)).toBeNull();
  });
  it('upscales g to kg when >= 1000', () => {
    expect(formatNetWeightDisplay(1500, { symbol: 'g' })).toBe('1.5 kg');
  });
  it('upscales ml to L when >= 1000', () => {
    expect(formatNetWeightDisplay(2000, { symbol: 'ml' })).toBe('2 L');
  });
  it('formats integer values', () => {
    expect(formatNetWeightDisplay(500, { symbol: 'g' })).toBe('500 g');
  });
  it('shows a package size as any other amount is shown', () => {
    for (const [amount, symbol] of [
      [1250, 'g'],
      [1333, 'mL'],
      [12.5, 'oz'],
    ] as const) {
      expect(formatNetWeightDisplay(amount, { symbol })).toBe(
        formatQuantityDisplay(amount, { symbol }),
      );
    }
  });
});

describe('formatAmountDisplay', () => {
  const can = {
    symbol: 'can',
    localizedSymbolForms: { one: 'lata', other: 'latas' },
  };

  it('shows the label the server agreed with the amount', () => {
    expect(
      formatAmountDisplay({
        quantity: 3,
        localizedSymbol: 'lattine',
        unit: can,
      }),
    ).toBe('3 lattine');
  });

  it('reads its unit when the label is blank, as an optimistic amount leaves it', () => {
    expect(
      formatAmountDisplay({ quantity: 3, localizedSymbol: '', unit: can }),
    ).toBe('3 latas');
  });

  it("writes a number where the server shows one, as the server's label reads", () => {
    expect(
      formatAmountDisplay({
        quantity: 0.5,
        localizedSymbol: 'lattine',
        fraction: null,
        unit: can,
      }),
    ).toBe('0.5 lattine');
    expect(
      formatAmountDisplay({
        quantity: 0.5,
        localizedSymbol: 'lattina',
        fraction: '½',
        unit: can,
      }),
    ).toBe('1/2 lattina');
  });

  it('upscales grams and millilitres as every quantity does', () => {
    expect(
      formatAmountDisplay({
        quantity: 1500,
        localizedSymbol: 'g',
        unit: { symbol: 'g' },
      }),
    ).toBe('1.5 kg');
  });
});

describe('formatAmountWithUnit', () => {
  const can = {
    symbol: 'can',
    localizedSymbolForms: { one: 'lata', other: 'latas' },
  };

  it("writes the figure as every quantity is, with the server's label", () => {
    expect(
      formatAmountWithUnit({
        quantity: 1.25,
        localizedSymbol: 'lattine',
        unit: can,
      }),
    ).toBe('1 1/4 lattine');
  });

  it('never upscales: the amount is what the stack holds', () => {
    expect(
      formatAmountWithUnit({
        quantity: 1500,
        localizedSymbol: 'g',
        unit: { symbol: 'g' },
      }),
    ).toBe('1500 g');
  });
});

describe('statedAmount', () => {
  const dozen = {
    symbol: 'doz',
    localizedSymbolForms: { one: 'dozzina', other: 'dozzine' },
  };

  it('states a fraction where the unit shows one, with the singular it reads', () => {
    expect(statedAmount(1.25, dozen, true)).toEqual({
      fraction: '1/4',
      localizedSymbol: 'dozzine',
    });
    expect(statedAmount(0.25, dozen, true)).toEqual({
      fraction: '1/4',
      localizedSymbol: 'dozzina',
    });
  });

  it('states a number where the unit shows none, read plural', () => {
    expect(statedAmount(0.5, dozen, false)).toEqual({
      fraction: null,
      localizedSymbol: 'dozzine',
    });
  });
});

describe('unitLabel', () => {
  afterEach(async () => {
    await getI18n().changeLanguage('en');
  });

  it('shows the localized short form', () => {
    expect(unitLabel({ symbol: 'pc', localizedSymbol: 'pz' })).toBe('pz');
  });

  it('falls back to the canonical symbol, then the name, when the localized one is blank', () => {
    // An optimistic unit the cache lacked is filled with the SDL neutral, ''.
    expect(unitLabel({ symbol: 'pc', localizedSymbol: '' })).toBe('pc');
    expect(unitLabel({ symbol: '', name: 'pinch' })).toBe('pinch');
  });

  it('is empty for no unit', () => {
    expect(unitLabel(null)).toBe('');
    expect(unitLabel({ symbol: null })).toBe('');
  });

  it('shows the singular short form without a quantity', () => {
    expect(
      unitLabel({
        symbol: 'can',
        localizedSymbolForms: { one: 'lata', other: 'latas' },
      }),
    ).toBe('lata');
  });

  it('shows the name, singular without a quantity, canonical when blank', () => {
    const cup = {
      symbol: 'cup',
      name: 'cup',
      localizedNameForms: { one: 'taza', other: 'tazas' },
    };
    expect(unitLabel(cup, { form: 'name' })).toBe('taza');
    expect(unitLabel(cup, { form: 'name', quantity: 3 })).toBe('tazas');
    expect(
      unitLabel(
        { ...cup, localizedNameForms: { one: '', other: '' } },
        { form: 'name' },
      ),
    ).toBe('cup');
  });

  it('falls back to the singular when the plural is blank', () => {
    const can = {
      symbol: 'can',
      name: 'can',
      localizedSymbolForms: { one: 'lata', other: '' },
      localizedNameForms: { one: 'lata', other: '' },
    };
    expect(unitLabel(can, { quantity: 3 })).toBe('lata');
    expect(unitLabel(can, { form: 'name', quantity: 3 })).toBe('lata');
  });

  // en and sq need one/other; es and it add many (1,000,000). Only 1 reads as
  // one, and a part of one reads singular: "1/2 cup", "mezzo cucchiaino".
  it.each([
    ['en', { one: 'can', other: 'cans' }],
    ['es', { one: 'lata', other: 'latas' }],
    ['it', { one: 'lattina', other: 'lattine' }],
    ['sq', { one: 'paketë', other: 'paketa' }],
  ])('picks the %s plural by its plural rules', async (language, forms) => {
    await getI18n().changeLanguage(language);
    const unit = {
      symbol: 'x',
      localizedSymbolForms: forms,
      localizedNameForms: forms,
    };
    for (const quantity of [0, 0.5, 1, 1.5, 2, 1_000_000]) {
      const expected =
        quantity === 1 || quantity === 0.5 ? forms.one : forms.other;
      expect(unitLabel(unit, { quantity })).toBe(expected);
      expect(unitLabel(unit, { form: 'name', quantity })).toBe(expected);
    }
  });

  it('reads a part of one singular only as a fraction is written', () => {
    const can = {
      symbol: 'can',
      localizedSymbolForms: { one: 'lata', other: 'latas' },
    };
    expect(unitLabel(can, { quantity: 0.5 })).toBe('lata');
    expect(unitLabel(can, { quantity: 0.5, notation: 'decimal' })).toBe(
      'latas',
    );
    // No cooking fraction fits 0.7, so it is written as a number.
    expect(unitLabel(can, { quantity: 0.7 })).toBe('latas');
    expect(formatQuantityWithUnit(0.5, can, { notation: 'decimal' })).toBe(
      '0.5 latas',
    );
  });

  it('reads a number by its size as written, to three places', () => {
    const can = {
      symbol: 'can',
      localizedSymbolForms: { one: 'lata', other: 'latas' },
    };
    expect(unitLabel(can, { quantity: -1 })).toBe('lata');
    expect(unitLabel(can, { quantity: 0.0001 })).toBe('latas');
    expect(unitLabel(can, { quantity: 0.9999 })).toBe('lata');
  });

  it('reads only 1 and a part of one as singular where the engine has no Intl.PluralRules', () => {
    const { PluralRules } = Intl;
    // Some Hermes builds ship without it.
    Object.defineProperty(Intl, 'PluralRules', {
      configurable: true,
      value: function Missing() {
        throw new TypeError('Intl.PluralRules is not a constructor');
      },
    });
    try {
      jest.isolateModules(() => {
        const isolated: typeof import('../formatQuantity') =
          jest.requireActual('../formatQuantity');
        const unit = {
          symbol: 'can',
          localizedSymbolForms: { one: 'lata', other: 'latas' },
        };
        expect(isolated.unitLabel(unit, { quantity: 0.5 })).toBe('lata');
        expect(isolated.unitLabel(unit, { quantity: 1 })).toBe('lata');
        expect(isolated.unitLabel(unit, { quantity: 2 })).toBe('latas');
      });
    } finally {
      Object.defineProperty(Intl, 'PluralRules', {
        configurable: true,
        value: PluralRules,
      });
    }
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
describe('formatQuantityWithUnit', () => {
  it('puts the unit after the quantity, as the chip shows them', () => {
    expect(formatQuantityWithUnit(2, { symbol: 'pc' })).toBe('2 pc');
    expect(formatQuantityWithUnit(1.5, { symbol: 'cup' })).toBe('1 1/2 cup');
  });

  it('is the quantity alone when there is no unit', () => {
    expect(formatQuantityWithUnit(3, null)).toBe('3');
  });

  it("reads the user's own text over the stored float", () => {
    expect(
      formatQuantityWithUnit(
        0.33333334,
        { symbol: 'cup' },
        {
          quantityInput: '0.33333334',
        },
      ),
    ).toBe('1/3 cup');
  });
});

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
