import { ValidationError } from 'yup';

import {
  shoppingItemSchema,
  SHOPPING_ITEM_DEFAULTS,
  DIRTY_TRACKED_FIELDS,
} from '../shoppingItemFormConfig';

/**
 * The validation rules shared by the AddEditItem screen and the
 * AddToShoppingList sheet, pinned here so neither consumer can drift on what
 * is required or on what the message says.
 */

/** Validate and return the message for `field`, or undefined when it passed. */
async function messageFor(
  values: Record<string, unknown>,
  field: string,
): Promise<string | undefined> {
  try {
    await shoppingItemSchema.validate(values, { abortEarly: false });
    return undefined;
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return error.inner.find(e => e.path === field)?.message;
  }
}

const base = SHOPPING_ITEM_DEFAULTS;

/** The message for `field` when the form holds `seed` as stored text. */
async function messageWithSeed(
  values: Record<string, unknown>,
  field: string,
  quantitySeed: string,
): Promise<string | undefined> {
  try {
    await shoppingItemSchema.validate(values, {
      abortEarly: false,
      context: { quantitySeed },
    });
    return undefined;
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return error.inner.find(e => e.path === field)?.message;
  }
}

// The API reads a line's quantity only as an amount, up to 999,999.
describe("a line's quantity, notes and price", () => {
  it.each(['2', '0.5', '1/3', '1 1/4'])('takes %p', async quantityInput => {
    expect(
      await messageFor(
        { ...base, itemName: 'Milk', quantityInput },
        'quantityInput',
      ),
    ).toBeUndefined();
  });

  it('refuses text it cannot read, saying what it takes', async () => {
    expect(
      await messageFor(
        { ...base, itemName: 'Salt', quantityInput: 'a pinch' },
        'quantityInput',
      ),
    ).toBe('Enter an amount like 2, 0.5 or 1 1/4');
  });

  it('leaves stored text alone until it is changed', async () => {
    const values = { ...base, itemName: 'Salt', quantityInput: 'a pinch' };
    expect(
      await messageWithSeed(values, 'quantityInput', 'a pinch'),
    ).toBeUndefined();
  });

  it('refuses more than 999,999', async () => {
    expect(
      await messageFor(
        { ...base, itemName: 'Rice', quantityInput: '1000000' },
        'quantityInput',
      ),
    ).toBe('Quantity cannot exceed 999,999');
  });

  it('holds notes to 500 characters', async () => {
    expect(
      await messageFor(
        { ...base, itemName: 'Milk', notes: 'x'.repeat(501) },
        'notes',
      ),
    ).toBe('Keep notes to 500 characters');
  });

  // A price it cannot read is said on the field, never sent as a clear.
  it('refuses a price it cannot read', async () => {
    expect(
      await messageFor(
        { ...base, itemName: 'Milk', estimatedPrice: 'abc' },
        'estimatedPrice',
      ),
    ).toBe('Enter a price like 4.99, or leave it empty.');
  });
});

describe('shoppingItemSchema', () => {
  describe('itemName', () => {
    it('is required', async () => {
      expect(await messageFor({ ...base, itemName: '' }, 'itemName')).toBe(
        'Please enter an item name',
      );
    });

    it('rejects whitespace only', async () => {
      expect(await messageFor({ ...base, itemName: '   ' }, 'itemName')).toBe(
        'Please enter an item name',
      );
    });
  });

  describe('quantityInput', () => {
    it('is required', async () => {
      expect(
        await messageFor({ ...base, quantityInput: '' }, 'quantityInput'),
      ).toBe('Please enter a quantity');
    });
  });

  // The rule is all-or-nothing and is satisfied by the RESOLVED unit id only.
  // Both submit paths send the weight exclusively alongside `netWeightUnitId`,
  // so accepting a typed-but-unresolved symbol would pass the user through to
  // a save that drops the weight without saying so.
  describe('net weight', () => {
    const withWeight = { ...base, itemName: 'Rice', netWeight: '500' };

    it('passes when neither the weight nor the unit is given', async () => {
      expect(
        await messageFor({ ...base, itemName: 'Rice' }, 'netWeightUnit'),
      ).toBeUndefined();
    });

    it('refuses a weight with no unit at all', async () => {
      expect(await messageFor(withWeight, 'netWeightUnit')).toBe(
        'Please select a unit for the net weight.',
      );
    });

    it('refuses a typed unit symbol that never resolved to an id', async () => {
      expect(
        await messageFor(
          { ...withWeight, netWeightUnit: 'kg', netWeightUnitId: null },
          'netWeightUnit',
        ),
      ).toBe('Please select a unit for the net weight.');
    });

    it('accepts a resolved unit id', async () => {
      expect(
        await messageFor(
          { ...withWeight, netWeightUnit: 'g', netWeightUnitId: 'unit-g' },
          'netWeightUnit',
        ),
      ).toBeUndefined();
    });

    it('accepts a resolved id even with no display symbol', async () => {
      expect(
        await messageFor(
          { ...withWeight, netWeightUnit: '', netWeightUnitId: 'unit-g' },
          'netWeightUnit',
        ),
      ).toBeUndefined();
    });

    it('ignores a whitespace-only weight', async () => {
      expect(
        await messageFor(
          { ...base, itemName: 'Rice', netWeight: '   ' },
          'netWeightUnit',
        ),
      ).toBeUndefined();
    });

    // The other direction. The schema is unconditional here: "a
    // netWeightUnitId with no netWeight is always rejected — a unit with
    // nothing to measure means nothing."
    it('refuses a unit with no weight, reported on the weight', async () => {
      expect(
        await messageFor(
          {
            ...base,
            itemName: 'Rice',
            netWeightUnit: 'g',
            netWeightUnitId: 'unit-g',
          },
          'netWeight',
        ),
      ).toBe('Enter both a package size and its unit, or leave both empty.');
    });

    it('refuses a unit with a whitespace-only weight', async () => {
      expect(
        await messageFor(
          {
            ...base,
            itemName: 'Rice',
            netWeight: '   ',
            netWeightUnitId: 'unit-g',
          },
          'netWeight',
        ),
      ).toBe('Enter both a package size and its unit, or leave both empty.');
    });

    it('does not report on the weight when both are empty', async () => {
      expect(
        await messageFor({ ...base, itemName: 'Rice' }, 'netWeight'),
      ).toBeUndefined();
    });

    it('does not report on the weight when both are set', async () => {
      expect(
        await messageFor(
          {
            ...base,
            itemName: 'Rice',
            netWeight: '500',
            netWeightUnitId: 'unit-g',
          },
          'netWeight',
        ),
      ).toBeUndefined();
    });

    // A typed symbol is not a resolved id, so it does not make a unit "set"
    // in either direction.
    it('ignores an unresolved symbol when judging the weight', async () => {
      expect(
        await messageFor(
          { ...base, itemName: 'Rice', netWeightUnit: 'g' },
          'netWeight',
        ),
      ).toBeUndefined();
    });
  });
});

describe('DIRTY_TRACKED_FIELDS', () => {
  // `storeName` is the display label for `storeId` and is never submitted on
  // its own, so an edit to it must not make the form report itself as changed.
  it('excludes storeName', () => {
    expect(DIRTY_TRACKED_FIELDS).not.toContain('storeName');
  });

  it('covers every other default field', () => {
    const expected = Object.keys(SHOPPING_ITEM_DEFAULTS).filter(
      f => f !== 'storeName',
    );
    expect([...DIRTY_TRACKED_FIELDS].sort()).toEqual(expected.sort());
  });
});
