import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
} from '@apollo/client/errors';
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
        __typename: 'SyncPantryItemPayload',
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

  it('defers a DEADLOCK conflict as a retryable server error', () => {
    // The API documents DEADLOCK as a transient lock conflict ("safe to
    // retry") — the entry must stay queued for the next drain instead of
    // being reverted + dequeued like a genuine refusal.
    const error = new ReplayRejectedError(
      'ConflictError',
      'Transient lock conflict, safe to retry',
      'DEADLOCK',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('server');
    expect(queueError.retryable).toBe(true);
    expect(queueError.code).toBe('DEADLOCK');
  });

  it('keeps a non-DEADLOCK ConflictError permanently rejected', () => {
    const error = new ReplayRejectedError(
      'ConflictError',
      'You already reviewed this recipe',
      'CONFLICT',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('unknown');
    expect(queueError.retryable).toBe(false);
    expect(queueError.code).toBe('ConflictError');
  });
});

describe('classifyError — a retired unit reference', () => {
  // The API merged 46 alias `Unit` rows into their canonical row. A write
  // queued before that names an id the server cannot resolve; the write itself
  // is fine, so it is re-resolved and re-sent rather than reverted.
  it('classifies a NotFoundError naming a Unit as retryable', () => {
    const error = new ReplayRejectedError(
      'NotFoundError',
      'Unit not found',
      'NOT_FOUND',
      'Unit',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('stale-reference');
    expect(queueError.retryable).toBe(true);
  });

  it('matches the resource name case-insensitively', () => {
    // `resource` is documented as a logical type name, not an enum, so its
    // casing is not part of a contract worth pinning a behaviour to.
    const error = new ReplayRejectedError(
      'NotFoundError',
      'Unit not found',
      'NOT_FOUND',
      'unit',
    );

    expect(classifyError(error).type).toBe('stale-reference');
  });

  it('classifies a UNIT_INVALID refusal as retryable whatever the typename', () => {
    const error = new ReplayRejectedError(
      'ValidationError',
      'That unit cannot be used here',
      'UNIT_INVALID',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('stale-reference');
    expect(queueError.retryable).toBe(true);
    expect(queueError.code).toBe('UNIT_INVALID');
  });

  it('leaves a NotFoundError about anything else permanently rejected', () => {
    // Without the resource check this would retry a genuinely deleted row:
    // the item being gone and its unit being gone share a typename and a code.
    const error = new ReplayRejectedError(
      'NotFoundError',
      'Pantry item not found',
      'NOT_FOUND',
      'PantryItem',
    );

    const queueError = classifyError(error);

    expect(queueError.type).toBe('unknown');
    expect(queueError.retryable).toBe(false);
  });

  it('leaves a NotFoundError carrying no resource permanently rejected', () => {
    const error = new ReplayRejectedError(
      'NotFoundError',
      'Not found',
      'NOT_FOUND',
    );

    expect(classifyError(error).type).toBe('unknown');
  });
});

describe('classifyError — auth codes', () => {
  // The whole token-side family routes to `auth`, not just AUTH_TOKEN_EXPIRED:
  // QueueManager answers that classification with one proactiveTokenRefresh(),
  // which is exactly what a missing or expired token needs. Classifying them as
  // `unknown` instead would revert and dequeue the entry without ever retrying.
  it.each([
    'AUTH_TOKEN_EXPIRED',
    'AUTH_TOKEN_MISSING',
    'AUTH_REFRESH_TOKEN_INVALID',
    'UNAUTHENTICATED',
  ])('classifies %s as a retryable auth error', code => {
    const queueError = classifyError({ message: 'Not authorized', code });

    expect(queueError.type).toBe('auth');
    expect(queueError.retryable).toBe(true);
  });

  // A suspended account is permanent, so the resource-access branch must keep
  // winning over the auth branch — otherwise every queued entry spends a doomed
  // refresh attempt before failing anyway.
  it.each(['AUTH_ACCOUNT_SUSPENDED', 'FORBIDDEN'])(
    'keeps %s a permanent failure, ahead of the auth branch',
    code => {
      const queueError = classifyError({
        message: 'Account suspended or deleted',
        code,
      });

      expect(queueError.type).toBe('unknown');
      expect(queueError.retryable).toBe(false);
    },
  );

  // Current behavior, pinned deliberately: AUTH_ACCOUNT_LOCKED is excluded from
  // the session-ending set (the schema documents it as a temporary, self-clearing
  // failed-attempt lockout), so it reaches neither branch above and lands in the
  // permanent bucket — the queued change is reverted and dequeued over a window
  // that would have expired on its own. Revisit alongside the queue's deferral
  // policy; this test exists so the change is visible when it happens.
  it('currently treats AUTH_ACCOUNT_LOCKED as a permanent failure', () => {
    const queueError = classifyError({
      message: 'Too many attempts, try again later',
      code: 'AUTH_ACCOUNT_LOCKED',
    });

    expect(queueError.type).toBe('unknown');
    expect(queueError.retryable).toBe(false);
  });
});

// The queue replays through client.mutate, so a refusal arrives as one of
// Apollo's own error classes — not the flat `{ code }` object the suites above
// construct. Every code branch read `error.extensions.code`, which on
// CombinedGraphQLErrors is the RESPONSE-level extensions bag rather than the
// per-error one the API populates, so all of them were dead against real
// traffic while the synthetic fixtures kept passing.
describe('classifyError — real Apollo error shapes', () => {
  const combined = (code: string, message = 'Refused'): CombinedGraphQLErrors =>
    new CombinedGraphQLErrors({
      errors: [{ message, extensions: { code } }],
    });

  // Pins the reason readErrorCode exists: the property the old code read is a
  // different bag from the one the API populates, and it is empty here. If this
  // ever starts carrying the per-error code, the helper can be simplified.
  it('does not expose the per-error code on the response-level extensions', () => {
    const error = combined('FORBIDDEN');

    expect(error.extensions?.code).toBeUndefined();
    expect(error.errors[0].extensions?.code).toBe('FORBIDDEN');
  });

  it('reads the code from a CombinedGraphQLErrors, not the response extensions', () => {
    const queueError = classifyError(combined('AUTH_TOKEN_EXPIRED'));

    expect(queueError.code).toBe('AUTH_TOKEN_EXPIRED');
    expect(queueError.type).toBe('auth');
    expect(queueError.retryable).toBe(true);
  });

  it('reads the code from a CombinedProtocolErrors', () => {
    const queueError = classifyError(
      new CombinedProtocolErrors([
        { message: 'Denied', extensions: { code: 'FORBIDDEN' } },
      ]),
    );

    expect(queueError.code).toBe('FORBIDDEN');
    expect(queueError.type).toBe('unknown');
  });

  it('skips leading errors that carry no code', () => {
    const queueError = classifyError(
      new CombinedGraphQLErrors({
        errors: [
          { message: 'No code here' },
          { message: 'Denied', extensions: { code: 'FORBIDDEN' } },
        ],
      }),
    );

    expect(queueError.code).toBe('FORBIDDEN');
  });

  // Apollo 4 throws ServerError with statusCode directly; the
  // networkError.statusCode nesting is the Apollo 3 ApolloError shape.
  it('defers a 5xx ServerError instead of failing it permanently', () => {
    const queueError = classifyError(
      new ServerError('Internal Server Error', {
        response: { status: 500 } as Response,
        bodyText: 'Internal Server Error',
      }),
    );

    expect(queueError.type).toBe('server');
    expect(queueError.retryable).toBe(true);
  });

  it('keeps a 4xx ServerError a permanent failure', () => {
    const queueError = classifyError(
      new ServerError('Bad Request', {
        response: { status: 400 } as Response,
        bodyText: 'Bad Request',
      }),
    );

    expect(queueError.type).toBe('unknown');
    expect(queueError.retryable).toBe(false);
  });

  // queueStore persists lastError and replays it back through here.
  it('still reads the flat persisted shape', () => {
    expect(classifyError({ message: 'x', code: 'FORBIDDEN' }).code).toBe(
      'FORBIDDEN',
    );
    expect(
      classifyError({ message: 'x', extensions: { code: 'FORBIDDEN' } }).code,
    ).toBe('FORBIDDEN');
  });

  it('tolerates null and undefined', () => {
    expect(classifyError(null).type).toBe('unknown');
    expect(classifyError(undefined).type).toBe('unknown');
  });
});

// A refused build can't replay anything until the user updates from the store.
// Dropping the entry would lose work over a condition they can actually fix, so
// it stays queued — without burning the in-run retries on attempts that send
// the same version and are refused identically.
describe('classifyError — CLIENT_UPGRADE_REQUIRED', () => {
  it('defers the entry instead of reverting and dequeuing it', () => {
    const queueError = classifyError(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: 'This app version is no longer supported.',
            extensions: {
              code: 'CLIENT_UPGRADE_REQUIRED',
              minimumVersion: '5.0.0',
            },
          },
        ],
      }),
    );

    // QueueManager defers `network`/`server` regardless of `retryable`, so this
    // pair means "keep it PENDING, but don't spend attempts on it".
    expect(queueError.type).toBe('server');
    expect(queueError.retryable).toBe(false);
    expect(queueError.code).toBe('CLIENT_UPGRADE_REQUIRED');
  });
});
