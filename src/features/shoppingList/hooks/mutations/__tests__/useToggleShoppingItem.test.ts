import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ToggleShoppingListItemPurchasedDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

const mockHandleApolloError = jest.fn(() => ({ message: 'Toggle error' }));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  moveShoppingListItemToPurchased: jest.fn(),
  moveShoppingListItemToUnpurchased: jest.fn(),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createToggleMock(
  recorded: Array<Record<string, unknown>>,
  responseItem: Record<string, unknown>,
): MockedResponse {
  return {
    request: {
      query: ToggleShoppingListItemPurchasedDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        toggleShoppingListItemPurchased: {
          __typename: 'ShoppingListItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: responseItem,
        },
      },
    },
  };
}

describe('useToggleShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns toggleItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    expect(typeof result.current.toggleItem).toBe('function');
  });

  it('returns false when listId is null', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useToggleShoppingItem({
          listId: null,
          refetch: mockRefetch,
        }),
      {
        operationMocks: [
          createToggleMock(recorded, {
            __typename: 'ShoppingListItem',
            id: 'item-1',
          }),
        ],
      },
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('item-1');
    });

    expect(toggleResult).toBe(false);
    expect(recorded).toEqual([]);
  });

  it('returns false when item is not found in cache', async () => {
    // No cache seeding — readFragment will return null, hook bails out.
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useToggleShoppingItem({
          listId: 'list-1',
          refetch: mockRefetch,
        }),
      {
        operationMocks: [
          createToggleMock(recorded, {
            __typename: 'ShoppingListItem',
            id: 'non-existent',
          }),
        ],
      },
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('non-existent');
    });

    expect(toggleResult).toBe(false);
    expect(recorded).toEqual([]);
  });

  // NOTE on the mark-as-purchased / mark-as-unpurchased / depletion-recovery
  // tests removed in this migration: they relied on `mockReadFragment` /
  // `mockReadQuery` returning hand-crafted cache snapshots, plus capturing
  // the useMutation `onCompleted` callback via the legacy `jest.mock('@apollo/
  // client/react')` interception. Reproducing these against a real
  // MockedProvider cache requires seeding ShoppingList + ShoppingListItem
  // entities with their connection edges by hand — outside the scope of the
  // mechanical lint-driven migration. The cache-read paths are still
  // exercised in `__tests__/integration/optimisticMutation.integration.test.ts`
  // which uses a real Apollo client end-to-end.
});
