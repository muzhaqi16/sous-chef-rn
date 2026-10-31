import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, type InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { useStore } from '#store';
import {
  recordMock,
  renderHookWithApollo,
  seedQuery,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import { ErrorCode, SuggestionSurface } from '#/graphql/generated/schemaTypes';
import type { SuggestionParent } from '#features/catalog/cache/suggestions';
import { useSuggestionDismissal } from '#features/catalog/hooks/useSuggestionDismissal';
import { GetPantryItemSuggestionsDocument } from '#features/pantry/graphql/pantry.generated';

import { toastService } from '#/services/toastService';

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));

const mockSuccess = toastService.success as jest.Mock;
const mockError = toastService.error as jest.Mock;

const PANTRY: SuggestionParent = { __typename: 'Pantry', id: 'pantry-1' };
const VARIABLES = { pantryId: PANTRY.id, limit: 10, today: '2026-10-30' };

const entry = (
  itemId: string,
): { __typename: 'PantryItemSuggestion'; id: string; itemId: string } => ({
  __typename: 'PantryItemSuggestion',
  id: `suggestion-${itemId}`,
  itemId,
});

const seeded = (): InMemoryCache => {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryItemSuggestionsDocument,
    variables: VARIABLES,
    data: {
      pantry: {
        __typename: 'Pantry',
        id: PANTRY.id,
        suggestions: {
          __typename: 'PantrySuggestions',
          lowStock: [entry('item-1')],
          expiringSoon: [],
          recentlyDeleted: [],
          frequentlyAdded: [],
          popular: [entry('item-2'), entry('item-1'), entry('item-3')],
        },
      },
    },
  });
  return cache;
};

/** Where the sheet shows each suggestion, as it reads them. */
const shown = (cache: InMemoryCache) => {
  const sections = cache.readQuery({
    query: GetPantryItemSuggestionsDocument,
    variables: VARIABLES,
    optimistic: true,
  })?.pantry?.suggestions;
  return {
    lowStock: sections?.lowStock.map(({ itemId }) => itemId),
    popular: sections?.popular.map(({ itemId }) => itemId),
  };
};

const SHOWN = {
  lowStock: ['item-1'],
  popular: ['item-2', 'item-1', 'item-3'],
};
const DISMISSED = { lowStock: [], popular: ['item-2', 'item-3'] };

const dismissed = (surface = SuggestionSurface.Pantry) =>
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

const refusedDismissal = () =>
  recordMock(MarkSuggestionDismissedDocument, {
    data: {
      markSuggestionDismissed: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'unknown item',
      },
    },
  });

const render = (operationMocks: MockedResponse[], cache = seeded()) => {
  const { result } = renderHookWithApollo(
    () => useSuggestionDismissal(SuggestionSurface.Pantry, PANTRY),
    { operationMocks, cache },
  );
  return { result, cache };
};

const dismissItem = (
  dismissSuggestion: ReturnType<
    typeof useSuggestionDismissal
  >['dismissSuggestion'],
) => {
  act(() => {
    dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
  });
};

const pressUndo = () => {
  act(() => {
    mockSuccess.mock.calls[0][1].action.onPress();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useSuggestionDismissal', () => {
  it('takes the suggestion out of every section before sending, and offers Undo', async () => {
    const { fired, mock } = dismissed();
    const { result, cache } = render([mock]);

    dismissItem(result.current.dismissSuggestion);

    expect(shown(cache)).toEqual(DISMISSED);
    await drainTimers();
    expect(fired).toContainEqual({
      input: {
        itemId: 'item-1',
        surface: SuggestionSurface.Pantry,
        idempotencyKey: expect.any(String),
      },
    });
    expect(mockSuccess.mock.calls[0][1].action.label).toBeTruthy();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('keeps it out once answered, as the answer states no list', async () => {
    const { mock } = dismissed();
    const { result, cache } = render([mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();

    expect(shown(cache)).toEqual(DISMISSED);
  });

  it('sends one dismissal for a double tap', async () => {
    const { fired, mock } = dismissed();
    const { result } = render([mock]);

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await drainTimers();
    expect(fired).toHaveLength(1);
    expect(mockSuccess).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a surface with no parent yet', async () => {
    const { fired, mock } = dismissed();
    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, undefined),
      { operationMocks: [mock] },
    );

    dismissItem(result.current.dismissSuggestion);

    await drainTimers();
    expect(fired).toHaveLength(0);
  });

  it('puts back what it took when the server refuses', async () => {
    const { mock } = refusedDismissal();
    const { result, cache } = render([mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();

    expect(shown(cache)).toEqual(SHOWN);
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it('leaves a queued dismissal hidden, with nothing reported', async () => {
    const { mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: { markSuggestionDismissed: null },
    });
    const { result, cache } = render([mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();

    expect(shown(cache)).toEqual(DISMISSED);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('tells a throttled dismissal how long to wait, and restores the item', async () => {
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
    const { result, cache } = render([mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();

    expect(mockError).toHaveBeenCalledWith(
      'Too many requests. Please try again in 10 minutes.',
    );
    expect(shown(cache)).toEqual(SHOWN);
  });

  it('Undo puts the suggestion back in its place at once, then undismisses it', async () => {
    const dismissal = dismissed();
    const undismiss = activated();
    const { result, cache } = render([dismissal.mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();
    expect(shown(cache)).toEqual(DISMISSED);

    pressUndo();
    expect(shown(cache)).toEqual(SHOWN);

    await drainTimers();
    expect(undismiss.fired).toHaveLength(1);
    expect(shown(cache)).toEqual(SHOWN);
  });

  it('keys each dismissal and each Undo on its own', async () => {
    const dismissal = dismissed();
    const undismiss = activated();
    const { result } = render([dismissal.mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();
    pressUndo();
    await drainTimers();

    const keyOf = (fired: readonly unknown[]) =>
      (fired[0] as { input: { idempotencyKey: string } }).input.idempotencyKey;
    expect(keyOf(dismissal.fired)).not.toBe(keyOf(undismiss.fired));
  });

  it('Undo waits for the dismissal to settle before undismissing', async () => {
    const dismissal = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
      held: true,
    });
    const undismiss = activated();
    const { result, cache } = render([dismissal.mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    pressUndo();
    await act(() => jest.advanceTimersByTimeAsync(0));

    expect(shown(cache)).toEqual(SHOWN);
    expect(undismiss.fired).toHaveLength(0);

    await act(async () => {
      dismissal.release();
    });
    await drainTimers();
    expect(undismiss.fired).toHaveLength(1);
    expect(shown(cache)).toEqual(SHOWN);
  });

  it('Undo of a refused dismissal sends nothing', async () => {
    const { mock } = refusedDismissal();
    const undismiss = activated();
    const { result, cache } = render([mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();
    pressUndo();
    await drainTimers();

    expect(undismiss.fired).toHaveLength(0);
    expect(shown(cache)).toEqual(SHOWN);
  });

  it('Undo that the server refuses takes the suggestion out again', async () => {
    const dismissal = dismissed();
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      data: {
        markSuggestionActive: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'unknown item',
        },
      },
    });
    const { result, cache } = render([dismissal.mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();
    pressUndo();
    await drainTimers();

    expect(shown(cache)).toEqual(DISMISSED);
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it('Undo reports a failure it has no code for in its own words', async () => {
    const dismissal = dismissed();
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      error: new Error('socket closed'),
    });
    const { result } = render([dismissal.mock, undismiss.mock]);

    dismissItem(result.current.dismissSuggestion);
    await drainTimers();
    pressUndo();
    await drainTimers();

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0][0]).not.toContain('socket closed');
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
    const cache = seeded();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([createQueueLink(), new MockLink([])]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApolloProvider, { client, children });
    const { result } = renderHook(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, PANTRY),
      { wrapper },
    );

    dismissItem(result.current.dismissSuggestion);
    pressUndo();

    // Each queued write keeps the key it was sent with, so its replays share it.
    const input = {
      itemId: 'item-1',
      surface: SuggestionSurface.Pantry,
      idempotencyKey: expect.any(String),
    };
    await drainTimers();
    expect(
      queueStore
        .getMutationsForUser(USER.id)
        .map(m => [m.operationName, m.variables]),
    ).toEqual([
      ['MarkSuggestionDismissed', { input }],
      ['MarkSuggestionActive', { input }],
    ]);
    const [dismissal, undo] = queueStore
      .getMutationsForUser(USER.id)
      .map(m => (m.variables as { input: { idempotencyKey: string } }).input);
    expect(dismissal?.idempotencyKey).not.toBe(undo?.idempotencyKey);
    expect(shown(cache)).toEqual(SHOWN);
    expect(mockError).not.toHaveBeenCalled();
  });
});
