import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useCreateShoppingList } from '../useCreateShoppingList';
import {
  addOptimisticShoppingList,
  buildOptimisticShoppingList,
  revertOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { useUser } from '#store/useAppStore';
import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '#/utils/errors/graphqlErrors';

// The hook only reads the auth identity through this selector.
jest.mock('#store/useAppStore', () => ({
  useUser: jest.fn(),
}));

// Run cache updates synchronously; control the mutation result per test.
// unwrapPayload stays real — it's the hook's throw mechanism under test.
jest.mock('#/utils/compilerSafeWrappers', () => {
  const actual = jest.requireActual('#/utils/compilerSafeWrappers');
  return {
    ...actual,
    executeCacheUpdate: jest.fn((fn: () => void) => fn()),
    executeMutation: jest.fn(),
  };
});

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
    jest
      .mocked(executeMutation)
      .mockResolvedValueOnce(successResult('srv-echo', 'Weekly'));

    const { result } = renderHookWithApollo(() =>
      useCreateShoppingList('Failed to create list'),
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
    expect(
      jest.mocked(addOptimisticShoppingList).mock.invocationCallOrder[0],
    ).toBeLessThan(jest.mocked(executeMutation).mock.invocationCallOrder[0]);

    // Online success returns the server entity.
    expect(created).toEqual({
      __typename: 'ShoppingList',
      id: 'srv-echo',
      name: 'Weekly',
    });
    expect(revertOptimisticShoppingList).not.toHaveBeenCalled();
  });

  it('treats a queued create (offline / API down) as success and returns the optimistic list', async () => {
    // The offline queue resolves intercepted mutations with no data and no
    // error — that's the queued signature classifyCreateResult keys on.
    jest.mocked(executeMutation).mockResolvedValueOnce({ data: null });

    const { result } = renderHookWithApollo(() =>
      useCreateShoppingList('Failed to create list'),
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
    jest.mocked(executeMutation).mockResolvedValueOnce({
      data: {
        createShoppingList: {
          __typename: 'ValidationError',
          code: 'VALIDATION_ERROR',
          message: 'Name is required',
          field: 'name',
        },
      },
    });

    const { result } = renderHookWithApollo(() =>
      useCreateShoppingList('Failed to create list'),
    );

    await act(async () => {
      await expect(
        result.current.createShoppingList({ name: '' }),
      ).rejects.toThrow(GraphQLDomainError);
    });

    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic list and throws the network error when the mutation call itself fails', async () => {
    // executeMutation returns false when the wrapped mutate() threw.
    jest.mocked(executeMutation).mockResolvedValueOnce(false);

    const { result } = renderHookWithApollo(() =>
      useCreateShoppingList('Failed to create list'),
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
    jest
      .mocked(executeMutation)
      .mockResolvedValueOnce(successResult('srv-1', 'Weekly'));

    const { result } = renderHookWithApollo(() =>
      useCreateShoppingList('Failed to create list'),
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
