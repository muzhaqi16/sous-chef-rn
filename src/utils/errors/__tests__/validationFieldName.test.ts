/**
 * `field` is what the client keys localized copy off. The server's `message`
 * is never returned — it is English, and the app localizes its own copy.
 */
import { validationFieldName } from '../mutationPayload';

describe('validationFieldName', () => {
  it('returns the field a ValidationError names', () => {
    expect(
      validationFieldName({
        updatePantryItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          field: 'unit',
          message:
            'Cannot change tracking unit while batches exist. Deplete all batches first.',
        },
      }),
    ).toBe('unit');
  });

  // The API documents `field` as a dotted path ("input.quantity"), and sends a
  // bare name elsewhere. Callers key off one name either way.
  it('reduces a dotted path to its last segment', () => {
    expect(
      validationFieldName({
        updateShoppingListItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          field: 'input.quantity',
          message: 'Invalid fraction format',
        },
      }),
    ).toBe('quantity');
  });

  it('returns null for an unattributed ValidationError — the caller keeps its own copy', () => {
    expect(
      validationFieldName({
        updatePantryItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          field: null,
          message: 'Validation failed',
        },
      }),
    ).toBeNull();
  });

  it('returns null for a refusal that is not a ValidationError', () => {
    expect(
      validationFieldName({
        updatePantryItem: {
          __typename: 'ForbiddenError',
          code: 'FORBIDDEN',
          message: 'Not allowed',
        },
      }),
    ).toBeNull();
  });

  it('returns null for a success payload, and for nothing at all', () => {
    expect(
      validationFieldName({
        updatePantryItem: {
          __typename: 'UpdatePantryItemPayload',
          pantryItem: { id: '1' },
        },
      }),
    ).toBeNull();
    expect(validationFieldName(undefined)).toBeNull();
    expect(validationFieldName(null)).toBeNull();
  });
});
