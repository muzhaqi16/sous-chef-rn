import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetShoppingListTemplatesDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useShoppingListTemplates } from '../useShoppingListTemplates';

function buildTemplate(
  id: string,
  name: string,
  templateName: string | null,
  totalItems = 0,
) {
  return {
    __typename: 'ShoppingListEdge',
    cursor: id,
    node: {
      __typename: 'ShoppingList',
      id,
      name,
      templateName,
      totalItems,
    },
  };
}

const templatesMock: MockedResponse = {
  request: {
    query: GetShoppingListTemplatesDocument,
    variables: { first: 50 },
  },
  result: {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        totalCount: 2,
        edges: [
          buildTemplate('tpl-1', 'Weekly Groceries', 'Weekly Staples', 12),
          buildTemplate('tpl-2', 'Party List', null, 5),
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  },
};

describe('useShoppingListTemplates', () => {
  it('returns each template with its saved name, falling back to the list name', async () => {
    const { result } = renderHookWithApollo(() => useShoppingListTemplates(), {
      operationMocks: [templatesMock],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.templates).toEqual([
      { id: 'tpl-1', displayName: 'Weekly Staples', totalItems: 12 },
      { id: 'tpl-2', displayName: 'Party List', totalItems: 5 },
    ]);
  });

  it('returns nothing and fires no request when skipped', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListTemplates({ skip: true }),
      { operationMocks: [templatesMock] },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.templates).toEqual([]);
  });
});
