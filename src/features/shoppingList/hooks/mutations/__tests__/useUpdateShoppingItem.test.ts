import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useUpdateShoppingItem } from '../useUpdateShoppingItem';

type UpdateItemResult = Awaited<
  ReturnType<ReturnType<typeof useUpdateShoppingItem>['updateItem']>
>;

const mockHandleApolloError = jest.fn(() => ({ message: 'Update error' }));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Item was updated by someone else'),
}));

jest.mock('#/utils/finallyHelpers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createUpdateMock(
  recorded: Array<Record<string, unknown>>,
): MockedResponse {
  return {
    request: {
      query: UpdateShoppingListItemDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: {
            __typename: 'ShoppingListItem',
            id: 'item-1',
          },
        },
      },
    },
  };
}

describe('useUpdateShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns updateItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useUpdateShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.updateItem).toBe('function');
  });

  it('returns false when listId is null', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingItem({ listId: null, refetch: mockRefetch }),
      { operationMocks: [createUpdateMock(recorded)] },
    );

    let updateResult!: UpdateItemResult;
    await act(async () => {
      updateResult = await result.current.updateItem('item-1', { quantity: 3 });
    });

    expect(updateResult).toBe(false);
    expect(recorded).toEqual([]);
  });

  it('returns false when item not found in cache', async () => {
    // No cache seeding — readFragment returns null, hook bails out.
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [createUpdateMock(recorded)] },
    );

    let updateResult!: UpdateItemResult;
    await act(async () => {
      updateResult = await result.current.updateItem('non-existent', {
        quantity: 3,
      });
    });

    expect(updateResult).toBe(false);
    expect(recorded).toEqual([]);
  });
});
