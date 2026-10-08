import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useOpenListLinesFor } from '../useOpenListLinesFor';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const lookup = () =>
  recordMock(GetShoppingListItemsFilteredDocument, {
    dataFor: (
      vars,
    ): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => ({
      shoppingList: {
        __typename: 'ShoppingList',
        id: String(vars.id),
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    }),
  });

const itemsOf = (count: number) =>
  Array.from(
    { length: count },
    (_, at) => `item-${String(at).padStart(3, '0')}`,
  );

describe('useOpenListLinesFor', () => {
  it('asks for every item of a receipt, each once', async () => {
    const asked = lookup();
    const { result } = renderHookWithApollo(
      () => useOpenListLinesFor('list-1', ['item-b', 'item-a', 'item-b']),
      { operationMocks: [asked.mock] },
    );

    await waitFor(() => expect(asked.fired).toHaveLength(1));
    expect(asked.fired[0]?.itemIds).toEqual(['item-a', 'item-b']);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incomplete).toBe(false);
  });

  it('asks for at most the 100 items the API takes, and says the rest went unread', async () => {
    const asked = lookup();
    const { result } = renderHookWithApollo(
      () => useOpenListLinesFor('list-1', itemsOf(101)),
      { operationMocks: [asked.mock] },
    );

    await waitFor(() => expect(asked.fired).toHaveLength(1));
    expect(asked.fired[0]?.itemIds).toHaveLength(100);
    expect(result.current.incomplete).toBe(true);
  });
});
