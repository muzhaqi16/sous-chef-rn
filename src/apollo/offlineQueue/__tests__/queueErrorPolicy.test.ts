import {
  classifyError,
  classifyReplayResult,
  ReplayRejectedError,
} from '../queueErrorPolicy';

describe('classifyReplayResult', () => {
  it('returns applied for a success payload', () => {
    expect(
      classifyReplayResult('CreateShoppingList', {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: { id: 'list-1' },
        },
      }),
    ).toBe('applied');
  });

  it('returns applied for sync result payloads', () => {
    expect(
      classifyReplayResult('SyncPantryItem', {
        syncPantryItem: {
          __typename: 'SyncPantryItemResult',
          clientId: 'c1',
          wasCreated: true,
        },
      }),
    ).toBe('applied');
  });

  it('returns applied for scalar, null, and absent payloads', () => {
    expect(classifyReplayResult('DeleteThing', { deleteThing: true })).toBe(
      'applied',
    );
    expect(classifyReplayResult('DeleteThing', { deleteThing: null })).toBe(
      'applied',
    );
    expect(classifyReplayResult('DeleteThing', undefined)).toBe('applied');
    expect(classifyReplayResult('DeleteThing', {})).toBe('applied');
  });

  it('returns converged for a ConflictError on a Create* replay', () => {
    expect(
      classifyReplayResult('CreateMealPlan', {
        createMealPlan: {
          __typename: 'ConflictError',
          message: 'already exists',
        },
      }),
    ).toBe('converged');
  });

  it('returns rejected for a ConflictError on a non-create replay', () => {
    expect(
      classifyReplayResult('UpdateShoppingList', {
        updateShoppingList: {
          __typename: 'ConflictError',
          message: 'version conflict',
        },
      }),
    ).toBe('rejected');
  });

  it('returns rejected for other error payloads', () => {
    for (const typename of [
      'ValidationError',
      'ForbiddenError',
      'NotFoundError',
    ]) {
      expect(
        classifyReplayResult('CreateRecipe', {
          createRecipe: { __typename: typename, message: 'refused' },
        }),
      ).toBe('rejected');
    }
  });
});

describe('classifyError — ReplayRejectedError', () => {
  it('classifies by payload typename, never by message heuristics', () => {
    // The message contains "expired", which the string heuristics would
    // classify as a retryable auth error — a rejected replay must stay
    // non-retryable regardless of the server's message text.
    const error = new ReplayRejectedError(
      'ValidationError',
      'the coupon has expired',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('unknown');
    expect(queueError.retryable).toBe(false);
    expect(queueError.code).toBe('ValidationError');
    expect(queueError.message).toBe('the coupon has expired');
  });
});
