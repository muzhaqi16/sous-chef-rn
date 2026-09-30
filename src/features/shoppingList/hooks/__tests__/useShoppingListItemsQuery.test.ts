import { waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetShoppingListDetailsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useShoppingListItemsQuery } from '../useShoppingListItemsQuery';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

type DetailsMock = MockFor<typeof GetShoppingListDetailsDocument>;

const listMock = (
  id: string,
  response: { name: string; delay?: number } | { error: Error } | null,
): DetailsMock => ({
  request: {
    query: GetShoppingListDetailsDocument,
    variables: vars => vars.id === id,
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
  ...(response === null
    ? { result: { data: { shoppingList: null } } }
    : 'error' in response
    ? { error: response.error }
    : {
        delay: response.delay,
        result: {
          data: {
            shoppingList: {
              __typename: 'ShoppingList',
              id,
              name: response.name,
            },
          },
        },
      }),
});

const renderSwitch = (listTwo: DetailsMock) =>
  renderHookWithApollo(
    ({ listId }: { listId: string }) => useShoppingListItemsQuery(listId),
    {
      operationMocks: [listMock('list-1', { name: 'Old list' }), listTwo],
      initialProps: { listId: 'list-1' },
    },
  );

describe('useShoppingListItemsQuery — switching lists', () => {
  it('shows none of the old list while an unheld list loads', async () => {
    const { result, rerender } = renderSwitch(
      listMock('list-2', { name: 'New list', delay: 50 }),
    );
    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('Old list'),
    );

    rerender({ listId: 'list-2' });

    expect(result.current.shoppingList).toBeNull();
    expect(result.current.notFound).toBe(false);

    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('New list'),
    );
  });

  it('offline, reports the failure without the old list details', async () => {
    const { result, rerender } = renderSwitch(
      listMock('list-2', { error: new Error('Network request failed') }),
    );
    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('Old list'),
    );

    rerender({ listId: 'list-2' });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.shoppingList).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it('flags a list the server no longer returns as not found', async () => {
    const { result, rerender } = renderSwitch(listMock('list-2', null));
    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('Old list'),
    );

    rerender({ listId: 'list-2' });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.shoppingList).toBeNull();
  });

  it('serves nothing of the old list once no list is selected', async () => {
    const initialProps: { listId: string | undefined } = { listId: 'list-1' };
    const { result, rerender } = renderHookWithApollo(
      ({ listId }: { listId: string | undefined }) =>
        useShoppingListItemsQuery(listId),
      {
        operationMocks: [listMock('list-1', { name: 'Old list' })],
        initialProps,
      },
    );
    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('Old list'),
    );

    rerender({ listId: undefined });

    expect(result.current.shoppingList).toBeNull();
    expect(result.current.notFound).toBe(false);
  });
});
