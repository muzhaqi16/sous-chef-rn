import { ValidationError } from 'yup';
import {
  addPantryItemSchema,
  addPantryItemDefaults,
  FIELD_PAGE,
} from '../addPantryItemFormConfig';

/**
 * The validation rules for the Add-to-Pantry sheet.
 *
 * These used to live inside `usePantryItemSubmission` as three
 * `alertService.alert` calls: a modal that covered the form, had to be
 * dismissed before the field could be corrected, and once dismissed no longer
 * said which of the four pages the offending input was on. They are a schema
 * now, reported on the field, and this is where the rules themselves are
 * pinned.
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
  });

  describe('net weight is all-or-nothing', () => {
    const valid = { ...base, itemName: 'Milk' };

    it('needs a unit once a weight is typed', async () => {
      // The API rejects a weight with no unit, so this asks for the unit
      // rather than silently dropping the value the user entered.
      expect(
        await messageFor(
          { ...valid, pantryNetWeight: '500' },
          'pantryNetWeightUnit',
        ),
      ).toBe('Please select a unit for the net weight.');
    });

    it('passes once a unit is picked', async () => {
      expect(
        await messageFor(
          {
            ...valid,
            pantryNetWeight: '500',
            pantryNetWeightUnitId: 'unit-g',
          },
          'pantryNetWeightUnit',
        ),
      ).toBeUndefined();
    });

    it('does not ask for a unit when no weight was typed', async () => {
      expect(
        await messageFor({ ...valid }, 'pantryNetWeightUnit'),
      ).toBeUndefined();
    });
  });

  describe('FIELD_PAGE', () => {
    it('places every validated field on a page', async () => {
      // A message the user cannot see is no better than the alert this
      // replaced, so each validated field must map to the page it lives on.
      let inner: string[] = [];
      try {
        await addPantryItemSchema.validate(
          { ...base, itemName: '', quantityInput: '', pantryNetWeight: '5' },
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
