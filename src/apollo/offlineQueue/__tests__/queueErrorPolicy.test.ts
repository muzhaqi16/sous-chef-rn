import {
  classifyError,
  classifyReplayResult,
  ReplayRejectedError,
} from '../queueErrorPolicy';

describe('classifyReplayResult', () => {
  it('returns applied for a success payload', () => {
    expect(
      classifyReplayResult({
        __typename: 'CreateShoppingListPayload',
        shoppingList: { id: 'list-1' },
      }),
    ).toBe('applied');
  });

  it('returns applied for a converged success payload (favorites / cooking logs / sync ops)', () => {
    // A re-favorite / re-cook / sync replay converges as a SUCCESS payload with
    // converged:true — it doesn't end in `Error`, so it's already applied.
    expect(
      classifyReplayResult({
        __typename: 'AddRecipeToFavoritesPayload',
        converged: true,
      }),
    ).toBe('applied');
    expect(
      classifyReplayResult({
        __typename: 'SyncPantryItemResult',
        clientId: 'c1',
        converged: true,
      }),
    ).toBe('applied');
  });

  it('returns applied for scalar, null, and absent payloads', () => {
    expect(classifyReplayResult(true)).toBe('applied');
    expect(classifyReplayResult(null)).toBe('applied');
    expect(classifyReplayResult(undefined)).toBe('applied');
    expect(classifyReplayResult({})).toBe('applied');
  });

  it('converges a ConflictError whose code is IDEMPOTENT_REPLAY (any op)', () => {
    // Both an idempotency-keyed cumulative delta and a client-PK create surface
    // a replay as ConflictError(code: IDEMPOTENT_REPLAY) — the effect already
    // committed once, so dequeue as success regardless of operation.
    expect(
      classifyReplayResult({
        __typename: 'ConflictError',
        code: 'IDEMPOTENT_REPLAY',
        message: 'already applied',
      }),
    ).toBe('converged');
  });

  it('rejects a generic ConflictError (a real version/uniqueness conflict)', () => {
    // Same typename, different code — a genuine conflict must NOT be swallowed
    // as converged. Matched on the code, never the message.
    expect(
      classifyReplayResult({
        __typename: 'ConflictError',
        code: 'CONFLICT',
        message: 'version conflict',
      }),
    ).toBe('rejected');
    // No code at all → also rejected.
    expect(
      classifyReplayResult({
        __typename: 'ConflictError',
        message: 'version conflict',
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
        classifyReplayResult({
          __typename: typename,
          message: 'refused',
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
