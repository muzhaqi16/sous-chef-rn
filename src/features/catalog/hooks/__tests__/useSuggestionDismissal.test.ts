import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { useStore } from '#store';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import { ErrorCode, SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';

import { toastService } from '#/services/toastService';

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));

const mockSuccess = toastService.success as jest.Mock;
const mockError = toastService.error as jest.Mock;

/** The sheet's cache write, as a removal token the test can follow. */
const cacheWrites = () => ({
  remove: jest.fn((itemId: string) => ({ itemId })),
  restore: jest.fn(),
});

const dismissed = (surface = SuggestionSurface.Shopping) =>
  recordMock(MarkSuggestionDismissedDocument, {
    data: {
      markSuggestionDismissed: {
        __typename: 'MarkSuggestionDismissedPayload',
        itemId: 'item-1',
        surface,
        dismissed: true,
      },
    },
  });

const activated = () =>
  recordMock(MarkSuggestionActiveDocument, {
    data: {
      markSuggestionActive: {
        __typename: 'MarkSuggestionActivePayload',
        itemId: 'item-1',
        surface: SuggestionSurface.Pantry,
        dismissed: false,
      },
    },
  });

const pressUndo = () => {
  act(() => {
    mockSuccess.mock.calls[0][1].action.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSuggestionDismissal', () => {
  it('takes the suggestion out before sending, and offers Undo', async () => {
    const writes = cacheWrites();
    const { fired, mock } = dismissed();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, writes),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    expect(writes.remove).toHaveBeenCalledWith('item-1');
    await waitFor(() =>
      expect(fired).toContainEqual({
        input: {
          itemId: 'item-1',
          surface: SuggestionSurface.Shopping,
          idempotencyKey: expect.any(String),
        },
      }),
    );
    expect(mockSuccess.mock.calls[0][1].action.label).toBeTruthy();
    expect(mockError).not.toHaveBeenCalled();
    expect(writes.restore).not.toHaveBeenCalled();
  });

  it('sends one dismissal for a double tap', async () => {
    const taken = new Set<string>();
    const writes = {
      remove: jest.fn((itemId: string) => {
        if (taken.has(itemId)) return null;
        taken.add(itemId);
        return { itemId };
      }),
      restore: jest.fn(),
    };
    const { fired, mock } = dismissed();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, writes),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() => expect(fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fired).toHaveLength(1);
    expect(mockSuccess).toHaveBeenCalledTimes(1);
  });

  it('puts back what it took when the server refuses', async () => {
    const writes = cacheWrites();
    const { mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'unknown item',
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, writes),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'bad', name: 'Ghost' });
    });

    await waitFor(() =>
      expect(writes.restore).toHaveBeenCalledWith({ itemId: 'bad' }),
    );
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it('leaves a queued dismissal hidden, with nothing restored or reported', async () => {
    // The offline queue resolves a queued write with its payload field null.
    const writes = cacheWrites();
    const { fired, mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: { markSuggestionDismissed: null },
      partial: true,
    });
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, writes),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() => expect(fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(writes.restore).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('tells a throttled dismissal how long to wait, and restores the item', async () => {
    const writes = cacheWrites();
    const { mock } = recordMock(MarkSuggestionDismissedDocument, {
      error: Object.assign(new Error('rate limited'), {
        errors: [
          {
            message: 'Too many requests',
            extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
          },
        ],
      }),
    });
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, writes),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith(
        'Too many requests. Please try again in 10 minutes.',
      ),
    );
    expect(writes.restore).toHaveBeenCalledTimes(1);
  });

  it('Undo puts the suggestion back at once and then undismisses it', async () => {
    const writes = cacheWrites();
    const dismiss = dismissed(SuggestionSurface.Pantry);
    const undismiss = activated();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(dismiss.fired).toHaveLength(1));

    pressUndo();

    expect(writes.restore).toHaveBeenCalledWith({ itemId: 'item-1' });
    await waitFor(() =>
      expect(undismiss.fired).toContainEqual({
        input: {
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          idempotencyKey: expect.any(String),
        },
      }),
    );
    expect(writes.remove).toHaveBeenCalledTimes(1);
  });

  // The server refuses a key spent on the other mutation, and a shared key
  // would let one write's re-send stand in for the other.
  it('keys each dismissal and each Undo on its own', async () => {
    const writes = cacheWrites();
    const first = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    });
    const undismiss = activated();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [first.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(first.fired).toHaveLength(1));
    pressUndo();
    await waitFor(() => expect(undismiss.fired).toHaveLength(1));
    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-2', name: 'Eggs' });
    });
    await waitFor(() => expect(first.fired).toHaveLength(2));

    const keyOf = (variables: unknown) =>
      (variables as { input: { idempotencyKey: string } }).input.idempotencyKey;
    const keys = [
      keyOf(first.fired[0]),
      keyOf(undismiss.fired[0]),
      keyOf(first.fired[1]),
    ];
    expect(new Set(keys).size).toBe(3);
  });

  // Two requests in flight could land in either order; the undo must land last.
  it('Undo waits for the dismissal to settle before undismissing', async () => {
    const writes = cacheWrites();
    const dismiss = recordMock(MarkSuggestionDismissedDocument, {
      held: true,
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
    });
    const undismiss = activated();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    pressUndo();

    expect(writes.restore).toHaveBeenCalledTimes(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(undismiss.fired).toHaveLength(0);

    act(() => {
      dismiss.release();
    });

    await waitFor(() => expect(undismiss.fired).toHaveLength(1));
  });

  it('Undo of a refused dismissal sends nothing', async () => {
    const writes = cacheWrites();
    const { mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'unknown item',
        },
      },
    });
    const undismiss = activated();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(writes.restore).toHaveBeenCalledTimes(1));

    pressUndo();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(undismiss.fired).toHaveLength(0);
  });

  it('Undo that the server refuses takes the suggestion out again', async () => {
    const writes = cacheWrites();
    const dismiss = dismissed(SuggestionSurface.Pantry);
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      data: {
        markSuggestionActive: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'Suggestion not found',
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(dismiss.fired).toHaveLength(1));

    pressUndo();

    // A refusal resolves as data: it surfaces in its code's copy, never the
    // server's text, and the item stays dismissed.
    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith(
        'The requested item could not be found. It may have been deleted.',
      ),
    );
    expect(mockError).not.toHaveBeenCalledWith('Suggestion not found');
    expect(writes.remove).toHaveBeenCalledTimes(2);
  });

  it('Undo reports a failure it has no code for in its own words', async () => {
    const writes = cacheWrites();
    const dismiss = dismissed(SuggestionSurface.Pantry);
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(dismiss.fired).toHaveLength(1));

    pressUndo();

    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith("Couldn't undo"),
    );
    expect(writes.remove).toHaveBeenCalledTimes(2);
  });
});

describe('useSuggestionDismissal while offline', () => {
  const USER = {
    id: 'user-1',
    email: 'tani@example.com',
    emailVerified: true,
    onBoarded: true,
  };

  beforeEach(() => {
    useStore.setState({ user: USER, isOnline: false, apiReachable: null });
  });

  afterEach(() => {
    queueStore.clearQueueForUser(USER.id);
    useStore.setState({ user: null, isOnline: true, apiReachable: null });
  });

  // Replayed in this order, the server ends with the suggestion offered again.
  it('queues the dismissal and then its undo', async () => {
    const client = new ApolloClient({
      cache: makeCache(),
      link: ApolloLink.from([createQueueLink(), new MockLink([])]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApolloProvider, { client, children });
    const writes = cacheWrites();
    const { result } = renderHook(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, writes),
      { wrapper },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    pressUndo();

    // Each queued write keeps the key it was sent with, so its replays share it.
    const input = {
      itemId: 'item-1',
      surface: SuggestionSurface.Pantry,
      idempotencyKey: expect.any(String),
    };
    await waitFor(() =>
      expect(
        queueStore
          .getMutationsForUser(USER.id)
          .map(m => [m.operationName, m.variables]),
      ).toEqual([
        ['MarkSuggestionDismissed', { input }],
        ['MarkSuggestionActive', { input }],
      ]),
    );
    const [dismissal, undo] = queueStore
      .getMutationsForUser(USER.id)
      .map(m => (m.variables as { input: { idempotencyKey: string } }).input);
    expect(dismissal?.idempotencyKey).not.toBe(undo?.idempotencyKey);
    expect(writes.restore).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });
});
