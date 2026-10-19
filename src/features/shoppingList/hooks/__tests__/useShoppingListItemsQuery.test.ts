import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { GetShoppingListDetailsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useShoppingListItemsQuery } from '../useShoppingListItemsQuery';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

/** The list `id` as the server answers it: by name, failing, or gone (null). */
function listMock(
  id: string,
  response: { name: string } | { error: Error } | null,
  { held = false }: { held?: boolean } = {},
) {
  const answers = {
    match: (vars: Record<string, unknown>) => vars.id === id,
    held,
  };
  if (response === null) {
    return recordMock(GetShoppingListDetailsDocument, {
      ...answers,
      data: { shoppingList: null },
    });
  }
  if ('error' in response) {
    return recordMock(GetShoppingListDetailsDocument, {
      ...answers,
      error: response.error,
    });
  }
  return recordMock(GetShoppingListDetailsDocument, {
    ...answers,
    data: {
      shoppingList: { __typename: 'ShoppingList', id, name: response.name },
    },
  });
}

const renderSwitch = (listTwo: RecordedMock) =>
  renderHookWithApollo(
    ({ listId }: { listId: string }) => useShoppingListItemsQuery(listId),
    {
      operationMocks: [
        listMock('list-1', { name: 'Old list' }).mock,
        listTwo.mock,
      ],
      initialProps: { listId: 'list-1' },
    },
  );

describe('useShoppingListItemsQuery — switching lists', () => {
  it('shows none of the old list while an unheld list loads', async () => {
    const listTwo = listMock('list-2', { name: 'New list' }, { held: true });
    const { result, rerender } = renderSwitch(listTwo);
    await waitFor(() =>
      expect(result.current.shoppingList?.name).toBe('Old list'),
    );

    rerender({ listId: 'list-2' });

    expect(result.current.shoppingList).toBeNull();
    expect(result.current.notFound).toBe(false);

    await act(async () => listTwo.release());
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
        operationMocks: [listMock('list-1', { name: 'Old list' }).mock],
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
