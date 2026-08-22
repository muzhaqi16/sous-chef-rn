import { fieldValidationMessage } from '../mutationPayload';

describe('fieldValidationMessage', () => {
  it("returns a field-specific ValidationError's own sentence", () => {
    expect(
      fieldValidationMessage({
        updatePantryItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          field: 'unit',
          message:
            'Cannot change tracking unit while batches exist. Deplete all batches first.',
        },
      }),
    ).toBe(
      'Cannot change tracking unit while batches exist. Deplete all batches first.',
    );
  });

  it('returns null for an unattributed ValidationError — the caller keeps its own copy', () => {
    expect(
      fieldValidationMessage({
        updatePantryItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          field: null,
          message: 'Something was invalid',
        },
      }),
    ).toBeNull();
  });

  it('returns null for other error arms, success payloads, and queued (null) results', () => {
    expect(
      fieldValidationMessage({
        updatePantryItem: {
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'Stale version',
        },
      }),
    ).toBeNull();
    expect(
      fieldValidationMessage({
        updatePantryItem: { __typename: 'UpdatePantryItemPayload' },
      }),
    ).toBeNull();
    expect(fieldValidationMessage({ updatePantryItem: null })).toBeNull();
    expect(fieldValidationMessage(undefined)).toBeNull();
  });
});
