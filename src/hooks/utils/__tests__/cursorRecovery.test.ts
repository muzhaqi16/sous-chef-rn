import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLError } from 'graphql';
import { loadPageWithCursorRecovery } from '../cursorRecovery';
import { isDeadCursorError } from '#/utils/errors/graphqlErrors';

function refusal(code: string, message = 'Invalid cursor.') {
  return new CombinedGraphQLErrors({
    errors: [new GraphQLError(message, { extensions: { code } })],
  });
}

describe('isDeadCursorError', () => {
  it('reads a VALIDATION_FAILED on a cursor-bearing request as a dead cursor', () => {
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED'), { after: 'abc' }),
    ).toBe(true);
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED'), { cursor: 'abc' }),
    ).toBe(true);
  });

  it('never reads the message', () => {
    // The API's wording is the ONLY thing separating a refused cursor from any
    // other validation refusal, and branching on server prose is what the
    // localization rules exist to stop. Same code, different sentence.
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED', 'anything at all'), {
        after: 'abc',
      }),
    ).toBe(true);
  });

  it('is not a dead cursor when the request carried none', () => {
    // A first page cannot have a bad cursor, so the same code means something
    // else entirely and must not restart anything.
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), {})).toBe(false);
    expect(
      isDeadCursorError(refusal('VALIDATION_FAILED'), { after: null }),
    ).toBe(false);
    expect(isDeadCursorError(refusal('VALIDATION_FAILED'), undefined)).toBe(
      false,
    );
  });

  it('is not a dead cursor for another refusal, or for a transport failure', () => {
    expect(isDeadCursorError(refusal('FORBIDDEN'), { after: 'abc' })).toBe(
      false,
    );
    expect(isDeadCursorError(new Error('offline'), { after: 'abc' })).toBe(
      false,
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
