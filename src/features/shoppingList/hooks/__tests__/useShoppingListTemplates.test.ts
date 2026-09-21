import { waitFor } from '@testing-library/react-native';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetShoppingListTemplatesDocument,
  type GetShoppingListTemplatesQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { COPYABLE_ITEM_LIMIT } from '#features/shoppingList/cache/copySource';
import { useShoppingListTemplates } from '../useShoppingListTemplates';

type TemplateEdge = MockPart<
  GetShoppingListTemplatesQuery['shoppingLists']['edges'][number]
>;

function buildTemplate(
  id: string,
  name: string,
  templateName: string | null,
  totalItems = 0,
): TemplateEdge {
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

const templatesMock: MockFor<typeof GetShoppingListTemplatesDocument> = {
  request: {
    query: GetShoppingListTemplatesDocument,
    variables: { first: 50, copyableItemLimit: COPYABLE_ITEM_LIMIT },
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

    await waitFor(() => expect(result.current.templates).toHaveLength(2));

    expect(result.current.templates).toEqual([
      { id: 'tpl-1', displayName: 'Weekly Staples', totalItems: 12 },
      { id: 'tpl-2', displayName: 'Party List', totalItems: 5 },
    ]);
  });

  it('returns nothing when skipped', () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListTemplates({ skip: true }),
      { operationMocks: [templatesMock] },
    );

    expect(result.current.templates).toEqual([]);
  });
});
