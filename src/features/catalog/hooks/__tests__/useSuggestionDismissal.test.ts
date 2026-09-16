import { act, waitFor } from '@testing-library/react-native';
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

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn() },
}));

import { toastService } from '#/services/toastService';

const mockSuccess = toastService.success as jest.Mock;
const mockError = toastService.error as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSuggestionDismissal', () => {
  it('dismisses an item and shows a toast with Undo, without refetching on success', async () => {
    const refetch = jest.fn();
    const { fired, mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Shopping,
          dismissed: true,
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, refetch),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() =>
      expect(fired).toContainEqual({
        input: { itemId: 'item-1', surface: SuggestionSurface.Shopping },
      }),
    );

    // Success toast fired with an Undo action; no error; no success-refetch.
    expect(mockSuccess).toHaveBeenCalledTimes(1);
    expect(mockSuccess.mock.calls[0][1].action.label).toBeTruthy();
    expect(mockError).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('restores via refetch and shows an error toast when the server rejects', async () => {
    const refetch = jest.fn();
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
      () => useSuggestionDismissal(SuggestionSurface.Shopping, refetch),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'bad', name: 'Ghost' });
    });

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it('leaves a queued dismissal hidden, with nothing restored or reported', async () => {
    // The offline queue resolves a queued write with its payload field null.
    const refetch = jest.fn();
    const { fired, mock } = recordMock(MarkSuggestionDismissedDocument, {
      data: { markSuggestionDismissed: null },
      partial: true,
    });

    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Shopping, refetch),
      { operationMocks: [mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() => expect(fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(refetch).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('tells a throttled dismissal how long to wait, and restores the item', async () => {
    const refetch = jest.fn();
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
      () => useSuggestionDismissal(SuggestionSurface.Shopping, refetch),
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
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('Undo fires undismiss and refetches to bring the item back', async () => {
    const refetch = jest.fn();
    const dismiss = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
    });
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      data: {
        markSuggestionActive: {
          __typename: 'MarkSuggestionActivePayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: false,
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, refetch),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() => expect(dismiss.fired.length).toBe(1));

    // Trigger the toast's Undo action.
    act(() => {
      mockSuccess.mock.calls[0][1].action.onPress();
    });

    await waitFor(() =>
      expect(undismiss.fired).toContainEqual({
        input: { itemId: 'item-1', surface: SuggestionSurface.Pantry },
      }),
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('Undo surfaces an error and does not refetch when the server rejects', async () => {
    const refetch = jest.fn();
    const dismiss = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
    });
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
      () => useSuggestionDismissal(SuggestionSurface.Pantry, refetch),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });

    await waitFor(() => expect(dismiss.fired.length).toBe(1));
    refetch.mockClear(); // ignore the dismiss-path refetch behavior

    act(() => {
      mockSuccess.mock.calls[0][1].action.onPress();
    });

    await waitFor(() => expect(undismiss.fired.length).toBe(1));
    // A refusal resolves as data — it must surface in its code's copy, never
    // the server's text, and must NOT refetch (the item is still dismissed).
    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith(
        'The requested item could not be found. It may have been deleted.',
      ),
    );
    expect(mockError).not.toHaveBeenCalledWith('Suggestion not found');
    expect(refetch).not.toHaveBeenCalled();
  });

  it('Undo reports a failure it has no code for in its own words', async () => {
    const refetch = jest.fn();
    const dismiss = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'MarkSuggestionDismissedPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
    });
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      error: new Error('Network request failed'),
    });

    const { result } = renderHookWithApollo(
      () => useSuggestionDismissal(SuggestionSurface.Pantry, refetch),
      { operationMocks: [dismiss.mock, undismiss.mock] },
    );

    act(() => {
      result.current.dismissSuggestion({ itemId: 'item-1', name: 'Milk' });
    });
    await waitFor(() => expect(dismiss.fired.length).toBe(1));

    act(() => {
      mockSuccess.mock.calls[0][1].action.onPress();
    });

    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith("Couldn't undo"),
    );
    expect(refetch).not.toHaveBeenCalled();
  });
});
