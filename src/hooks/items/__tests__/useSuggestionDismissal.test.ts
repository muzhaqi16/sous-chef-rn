import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  MarkSuggestionDismissedDocument,
  MarkSuggestionActiveDocument,
} from '#operations/item/item.generated';
import { SuggestionSurface } from '#/graphql/generated/schemaTypes';
import { useSuggestionDismissal } from '../useSuggestionDismissal';

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
          __typename: 'DismissSuggestionPayload',
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
          code: 'NOT_FOUND',
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

  it('Undo fires undismiss and refetches to bring the item back', async () => {
    const refetch = jest.fn();
    const dismiss = recordMock(MarkSuggestionDismissedDocument, {
      data: {
        markSuggestionDismissed: {
          __typename: 'DismissSuggestionPayload',
          itemId: 'item-1',
          surface: SuggestionSurface.Pantry,
          dismissed: true,
        },
      },
    });
    const undismiss = recordMock(MarkSuggestionActiveDocument, {
      data: {
        markSuggestionActive: {
          __typename: 'UndismissSuggestionPayload',
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
});
