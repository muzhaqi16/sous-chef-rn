import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLError } from 'graphql';
import { loadPageWithCursorRecovery } from '../cursorRecovery';
import { isDeadCursorError } from '#/utils/errors/graphqlErrors';
import { errorService } from '#/services/errorService';

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

function refusal(code: string, message = 'Invalid cursor.') {
  return new CombinedGraphQLErrors({
    errors: [new GraphQLError(message, { extensions: { code } })],
  });
}

describe('isDeadCursorError', () => {
  it('reads a VALIDATION_FAILED on a cursor-bearing request as a dead cursor', () => {
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), 'abc')).toBe(true);
  });

  it('recognises a cursor whatever the connection calls its argument', () => {
    // The pantry's is `itemsCursor`. Keyed on a fixed pair of argument names,
    // the one caller wired up for restart was the one it could never fire for.
    const variables: Record<string, unknown> = {
      itemsCursor: 'abc',
      itemsFirst: 20,
    };
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED'), variables.itemsCursor),
    ).toBe(true);
  });

  it('never reads the message', () => {
    // The API's wording is the ONLY thing separating a refused cursor from any
    // other validation refusal, and branching on server prose is what the
    // localization rules exist to stop. Same code, different sentence.
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED', 'anything at all'), 'abc'),
    ).toBe(true);
  });

  it('is not a dead cursor when the request carried none', () => {
    // A first page cannot have a bad cursor, so the same code means something
    // else entirely and must not restart anything.
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), undefined)).toBe(
      false,
    );
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), null)).toBe(false);
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), '')).toBe(false);
  });

  it('is not a dead cursor for another refusal, or for a transport failure', () => {
    expect(isDeadCursorError(refusal('FORBIDDEN'), 'abc')).toBe(false);
    expect(isDeadCursorError(new Error('offline'), 'abc')).toBe(false);
  });
});

// The class recognised is wider than a cursor, because the API answers every
// refused pagination argument with one code and no field. What keeps that
// bounded is the recovery: one restart, never re-entered, always reported.
describe('cursor recovery is bounded and reported', () => {
  const variables = { after: 'stale-cursor', first: 20 };

  it('spends exactly two requests when the restart is refused too', async () => {
    const fetchMore = jest.fn().mockRejectedValue(refusal('VALIDATION_FAILED'));
    const refetch = jest.fn().mockRejectedValue(refusal('VALIDATION_FAILED'));

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'pantry.loadMore',
    });

    expect(fetchMore).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reports a failure that is not a cursor refusal, and does not restart', async () => {
    const fetchMore = jest.fn().mockRejectedValue(refusal('FORBIDDEN'));
    const refetch = jest.fn().mockResolvedValue({});

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'pantry.loadMore',
    });

    expect(refetch).not.toHaveBeenCalled();
    expect(errorService.reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: 'pantry.loadMore' }),
    );
  });

  it('reports a failed restart separately from the failure that prompted it', async () => {
    const fetchMore = jest.fn().mockRejectedValue(refusal('VALIDATION_FAILED'));
    const refetch = jest.fn().mockRejectedValue(new Error('offline'));

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'pantry.loadMore',
    });

    expect(errorService.reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: 'pantry.loadMore.restartAfterDeadCursor',
      }),
    );
  });
});

describe('loadPageWithCursorRecovery', () => {
  const variables = { after: 'stale-cursor', first: 20 };

  it('does not refetch when the page loads', async () => {
    const fetchMore = jest.fn().mockResolvedValue({});
    const refetch = jest.fn().mockResolvedValue({});

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'test',
    });

    expect(fetchMore).toHaveBeenCalledWith({ variables });
    expect(refetch).not.toHaveBeenCalled();
  });

  it('restarts exactly once and never re-presents the refused cursor', async () => {
    const fetchMore = jest.fn().mockRejectedValue(refusal('VALIDATION_FAILED'));
    const refetch = jest.fn().mockResolvedValue({});

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'test',
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    // Re-sending the value the server just refused would loop.
    expect(fetchMore).toHaveBeenCalledTimes(1);
  });

  it('leaves an ordinary page failure alone', async () => {
    const fetchMore = jest.fn().mockRejectedValue(new Error('offline'));
    const refetch = jest.fn().mockResolvedValue({});

    await loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables,
      operation: 'test',
    });

    expect(refetch).not.toHaveBeenCalled();
  });

  it('reports rather than throws when the restart also fails', async () => {
    const fetchMore = jest.fn().mockRejectedValue(refusal('VALIDATION_FAILED'));
    const refetch = jest.fn().mockRejectedValue(new Error('still broken'));

    await expect(
      loadPageWithCursorRecovery({
        fetchMore,
        refetch,
        variables,
        operation: 'test',
      }),
    ).resolves.toBeUndefined();
  });
});
