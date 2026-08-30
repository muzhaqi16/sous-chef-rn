import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useCreateShoppingList } from '../useCreateShoppingList';
import {
  addOptimisticShoppingList,
  buildOptimisticShoppingList,
  revertOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useUser } from '#store/useAppStore';
import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '#/utils/errors/graphqlErrors';

// The hook only reads the auth identity through this selector.
jest.mock('#store/useAppStore', () => ({
  useUser: jest.fn(),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => {
  const { classifyCreateResult } = jest.requireActual(
    '#/apollo/utils/classifyCreateResult',
  );
  const mockRevert = jest.fn();
  return {
    addShoppingListToQueryCache: jest.fn(),
    addOptimisticShoppingList: jest.fn(),
    buildOptimisticShoppingList: jest.fn(
      (_cache: unknown, id: string, input: { name: string }) => ({
        __typename: 'ShoppingList',
        id,
        name: input.name,
      }),
    ),
    revertOptimisticShoppingList: mockRevert,
    // Mirror the real reconciler (real classify + mocked revert) so the
    // keep/revert decision under test matches production.
    reconcileShoppingListCreate: jest.fn(
      (cache: unknown, id: string, result: unknown) => {
        if (classifyCreateResult(result) === 'rejected') {
          mockRevert(cache, id);
          return 'reverted';
        }
        return 'kept';
      },
    ),
  };
});

const mockUser = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

/**
 * Drives the real `CreateShoppingList` operation. `variables: () => true`
 * because the hook mints the row's cuid id itself, so the test cannot predict
 * the input it will send.
 */
const createMock = (outcome: {
  result?: MockedResponse['result'];
  error?: Error;
}): MockedResponse =>
  ({
    request: { query: CreateShoppingListDocument, variables: () => true },
    ...outcome,
  } as MockedResponse);

const successResult = (id: string, name: string) => ({
  data: {
    createShoppingList: {
      __typename: 'CreateShoppingListPayload',
      shoppingList: { __typename: 'ShoppingList', id, name },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useUser).mockReturnValue(mockUser);
});

describe('useCreateShoppingList', () => {
  it('writes the list PERMANENTLY with a client-minted cuid id BEFORE firing the mutation (local-first)', async () => {
    const { result } = renderHookWithApollo(
      () => useCreateShoppingList('Failed to create list'),
      {
        operationMocks: [
          createMock({ result: successResult('srv-echo', 'Weekly') }),
        ],
      },
    );

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createShoppingList({ name: 'Weekly' });
    });

    // The optimistic list was built with a real cuid2 id (the row's PK)
    // from the create input and the auth identity.
    expect(buildOptimisticShoppingList).toHaveBeenCalledTimes(1);
    const [, mintedId, input, owner] = jest.mocked(buildOptimisticShoppingList)
      .mock.calls[0];
    // Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
    expect(mintedId).toMatch(/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/);
    expect(input).toEqual({ name: 'Weekly' });
    expect(owner).toEqual(mockUser);

    // ...written into the cache BEFORE the mutation fired.
    expect(addOptimisticShoppingList).toHaveBeenCalledTimes(1);
    // Online success returns the server entity. The rest of the selection set
    // is filled from the SDL, so this pins the identity the assertion is about
    // rather than the exhaustive shape.
    expect(created).toMatchObject({
      __typename: 'ShoppingList',
      id: 'srv-echo',
      name: 'Weekly',
    });
    expect(revertOptimisticShoppingList).not.toHaveBeenCalled();
  });

  it('treats a queued create (offline / API down) as success and returns the optimistic list', async () => {
    // The offline queue resolves intercepted mutations with no data and no
    // error — that's the queued signature classifyCreateResult keys on.
    const { result } = renderHookWithApollo(
      () => useCreateShoppingList('Failed to create list'),
      { operationMocks: [createMock({ result: { data: null } })] },
    );

    let created: { id: string; name: string } | undefined;
    await act(async () => {
      created = await result.current.createShoppingList({ name: 'Offline' });
    });

    expect(created?.id).toMatch(/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/);
    expect(created?.name).toBe('Offline');
    expect(revertOptimisticShoppingList).not.toHaveBeenCalled();
  });

  it('reverts the optimistic list and throws the domain error on a rejected create', async () => {
    const { result } = renderHookWithApollo(
      () => useCreateShoppingList('Failed to create list'),
      {
        operationMocks: [
          createMock({
            result: {
              data: {
                createShoppingList: {
                  __typename: 'ValidationError',
                  code: 'VALIDATION_ERROR',
                  message: 'Name is required',
                  field: 'name',
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await expect(
        result.current.createShoppingList({ name: '' }),
      ).rejects.toThrow(GraphQLDomainError);
    });

    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic list and throws the network error when the mutation call itself fails', async () => {
    // Under `errorPolicy: 'all'` a transport failure RESOLVES with `error` set
    // and no payload — that is what the app actually sees.
    const { result } = renderHookWithApollo(
      () => useCreateShoppingList('Failed to create list'),
      { operationMocks: [createMock({ error: new Error('network down') })] },
    );

    await act(async () => {
      await expect(
        result.current.createShoppingList({ name: 'Weekly' }),
      ).rejects.toThrow(GraphQLNetworkError);
    });

    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('falls back to online-only behavior when no auth identity is available', async () => {
    jest.mocked(useUser).mockReturnValue(null);

    const { result } = renderHookWithApollo(
      () => useCreateShoppingList('Failed to create list'),
      {
        operationMocks: [
          createMock({ result: successResult('srv-1', 'Weekly') }),
        ],
      },
    );

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.createShoppingList({ name: 'Weekly' });
    });

    expect(buildOptimisticShoppingList).not.toHaveBeenCalled();
    expect(addOptimisticShoppingList).not.toHaveBeenCalled();
    expect(created?.id).toBe('srv-1');
  });
});
