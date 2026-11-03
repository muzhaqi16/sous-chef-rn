import { ValidationError } from 'yup';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
  FIELD_PAGE,
} from '../addPantryItemFormConfig';

/**
 * The validation rules for the Add-to-Pantry sheet.
 *
 * A schema, reported on the field, rather than `alertService.alert` calls: a
 * modal covers the form, has to be dismissed before the field can be corrected,
 * and once dismissed cannot say which of the four pages the offending input
 * was on. This is where the rules themselves are pinned.
 */

/** Validate and return the message for `field`, or undefined when it passed. */
async function messageFor(
  values: Record<string, unknown>,
  field: string,
): Promise<string | undefined> {
  try {
    await addPantryItemSchema.validate(values, { abortEarly: false });
    return undefined;
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return error.inner.find(e => e.path === field)?.message;
  }
}

const base = addPantryItemDefaults('');

describe('addPantryItemSchema', () => {
  describe('itemName', () => {
    it('is required', async () => {
      expect(await messageFor({ ...base, itemName: '' }, 'itemName')).toBe(
        'Please enter an item name',
      );
    });

    it('rejects whitespace alone', async () => {
      expect(await messageFor({ ...base, itemName: '   ' }, 'itemName')).toBe(
        'Please enter an item name',
      );
    });

    it('accepts a name', async () => {
      expect(
        await messageFor({ ...base, itemName: 'Milk' }, 'itemName'),
      ).toBeUndefined();
    });
  });

  describe('quantityInput', () => {
    const valid = { ...base, itemName: 'Milk' };

    it.each(['', '   ', 'abc', '0', '0.0', '0/4', '-1'])(
      'rejects %p',
      async input => {
        expect(
          await messageFor({ ...valid, quantityInput: input }, 'quantityInput'),
        ).toBe('Please enter a valid quantity');
      },
    );

    it.each(['1', '2.5', '1/2', '1 1/4'])('accepts %p', async input => {
      expect(
        await messageFor({ ...valid, quantityInput: input }, 'quantityInput'),
      ).toBeUndefined();
    });

    // The keypad on an es/it/sq device offers a comma and no point at all, so
    // a rule that accepts only `.` makes fractional quantities unenterable in
    // three of the four shipped locales.
    it.each(['2,5', '0,5', '.5', '1,25'])(
      'accepts %p from a comma-decimal keypad',
      async input => {
        expect(
          await messageFor({ ...valid, quantityInput: input }, 'quantityInput'),
        ).toBeUndefined();
      },
    );

    // Validation and parsing have to agree. The schema decides whether Add is
    // allowed; `parseFractionalInput` is what converts what the user typed. A
    // regex that restated the parser's grammar by hand is what let them drift.
    it.each([
      '1',
      '2.5',
      '2,5',
      '0,5',
      '.5',
      '1/2',
      '1 1/4',
      '10',
      '0',
      '0.0',
      '0,0',
      '0/4',
      '-1',
      '-2,5',
      'abc',
      '',
      '   ',
      '1..2',
      '1/0',
    ])('agrees with parseFractionalInput on %p', async input => {
      const parsed = parseFractionalInput(input);
      const accepted =
        (await messageFor(
          { ...valid, quantityInput: input },
          'quantityInput',
        )) === undefined;

      expect(accepted).toBe(parsed !== null && parsed > 0);
    });
  });

  describe('what one package holds', () => {
    const valid = { ...base, itemName: 'Milk' };

    it('asks for a unit once a size is typed', async () => {
      expect(
        await messageFor({ ...valid, sizeInput: '500' }, 'sizeUnitId'),
      ).toBe('Pick the size’s unit from the list.');
    });

    it('passes once a unit is picked', async () => {
      expect(
        await messageFor(
          { ...valid, sizeInput: '500', sizeUnitId: 'unit-g' },
          'sizeUnitId',
        ),
      ).toBeUndefined();
    });

    it('asks for no unit when no size was typed', async () => {
      expect(await messageFor(valid, 'sizeUnitId')).toBeUndefined();
    });

    it('refuses a size that is not a positive number', async () => {
      expect(
        await messageFor(
          { ...valid, sizeInput: '0', sizeUnitId: 'unit-g' },
          'sizeInput',
        ),
      ).toBe('Enter a size greater than 0.');
    });

    it('counts packages whole once something is stated inside', async () => {
      expect(
        await messageFor(
          {
            ...valid,
            quantityInput: '1.5',
            sizeInput: '5',
            sizeUnitId: 'unit-lb',
          },
          'quantityInput',
        ),
      ).toBe('Packages are counted whole: 1, 2, 3…');
    });

    it('takes a part of a package with nothing stated inside', async () => {
      expect(
        await messageFor({ ...valid, quantityInput: '1.5' }, 'quantityInput'),
      ).toBeUndefined();
    });

    // A measure offers no "each holds": what is left in it was never seen.
    it('ignores a size left behind once the unit is a measure', async () => {
      const left = {
        ...valid,
        quantityInput: '1.5',
        unitType: UnitType.Weight,
        sizeInput: '5',
      };
      expect(await messageFor(left, 'quantityInput')).toBeUndefined();
      expect(await messageFor(left, 'sizeUnitId')).toBeUndefined();
    });
  });

  describe('FIELD_PAGE', () => {
    it('places every validated field on a page', async () => {
      // A message the user cannot see is no better than the alert this
      // replaced, so each validated field must map to the page it lives on.
      let inner: string[] = [];
      try {
        await addPantryItemSchema.validate(
          { ...base, itemName: '', quantityInput: '', sizeInput: '5' },
          { abortEarly: false },
        );
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        inner = error.inner.map(e => e.path ?? '');
      }

      expect(inner.length).toBeGreaterThan(0);
      for (const path of inner) {
        expect(FIELD_PAGE).toHaveProperty(path);
      }
    });
  });
});
