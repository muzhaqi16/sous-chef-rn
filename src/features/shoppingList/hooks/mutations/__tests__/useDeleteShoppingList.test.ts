import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useDeleteShoppingList } from '../useDeleteShoppingList';
import { toastService } from '#/services/toastService';

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));

describe('useDeleteShoppingList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('toasts localized copy, not the server’s English', async () => {
    // The server's message is unlocalizable by construction: the client sends
    // no `Accept-Language` and the token carries no locale, so an es / it / sq
    // user gets a translated title over an English body.
    const failure: MockedResponse = {
      request: { query: DeleteShoppingListDocument, variables: () => true },
      error: new Error('An unexpected database error occurred'),
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result } = renderHookWithApollo(() => useDeleteShoppingList(), {
      operationMocks: [failure],
    });

    await result.current.deleteShoppingList('list-1');

    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    expect(toastService.error).not.toHaveBeenCalledWith(
      'An unexpected database error occurred',
    );
  });
});
