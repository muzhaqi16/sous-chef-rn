import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { useSetDefaultShoppingList } from '../useSetDefaultShoppingList';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));

// Setting the default list is ONLINE-ONLY: it no longer writes the cache ahead
// of the server or queues for replay, so the offline gate is part of the hook's
// contract rather than an incidental detail.
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));
const mockIsApiUnavailable = useIsApiUnavailable as jest.MockedFunction<
  typeof useIsApiUnavailable
>;

const IS_DEFAULT = gql`
  fragment testIsDefault on ShoppingList {
    id
    isDefault
  }
`;

const readDefault = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ isDefault: boolean }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: IS_DEFAULT,
  })?.isDefault;

const seedList = () =>
  seedCache([{ __typename: 'ShoppingList', id: 'list-1', isDefault: false }]);

describe('useSetDefaultShoppingList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsApiUnavailable.mockReturnValue(false);
  });

  it("normalizes the server's isDefault and returns true", async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(() => useSetDefaultShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: MarkShoppingListAsDefaultDocument,
            variables: () => true,
          },
          result: {
            data: {
              markShoppingListAsDefault: {
                __typename: 'MarkShoppingListAsDefaultPayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-1',
                  isDefault: true,
                  updatedAt: '2026-08-28T00:00:00.000Z',
                  version: 2,
                },
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setAsDefault('list-1');
      // Nothing is written ahead of the server any more.
      expect(readDefault(cache)).toBe(false);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    await waitFor(() => {
      expect(readDefault(cache)).toBe(true);
    });
  });

  it('leaves the flag untouched and returns false on a rejection', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(() => useSetDefaultShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: MarkShoppingListAsDefaultDocument,
            variables: () => true,
          },
          result: {
            data: {
              markShoppingListAsDefault: {
                __typename: 'NotFoundError',
                code: 'NOT_FOUND',
                message: 'gone',
                resource: 'ShoppingList',
                resourceId: 'list-1',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setAsDefault('list-1');
    });

    expect(resolved).toBe(false);
    expect(readDefault(cache)).toBe(false);
  });

  it('refuses offline without firing the mutation', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const cache = seedList();
    const { result } = renderHookWithApollo(() => useSetDefaultShoppingList(), {
      cache,
      operationMocks: [],
    });

    expect(result.current.isApiUnavailable).toBe(true);

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setAsDefault('list-1');
    });

    expect(resolved).toBe(false);
    expect(readDefault(cache)).toBe(false);
    expect(toastService.error).toHaveBeenCalled();
  });
});
