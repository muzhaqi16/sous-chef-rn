import { InMemoryCache, gql } from '@apollo/client';
import {
  connectionOf,
  typedConnectionOf,
} from '#/test-utils/fixtures/connectionOf';

const LISTS = gql`
  query Lists {
    shoppingLists {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const weekly = { __typename: 'ShoppingList', id: 'sl-1', name: 'Weekly' };

describe('connectionOf', () => {
  it('builds one page of edges, counting the nodes unless told the total', () => {
    expect(
      connectionOf([weekly], { totalCount: 3, hasNextPage: true }),
    ).toEqual({
      totalCount: 3,
      pageInfo: { hasNextPage: true, endCursor: null },
      edges: [{ node: weekly }],
    });
    expect(connectionOf([]).totalCount).toBe(0);
  });

  it('round-trips through the cache when typed', () => {
    const cache = new InMemoryCache();
    const shoppingLists = typedConnectionOf('ShoppingList', [weekly], {
      endCursor: 'c1',
    });

    cache.writeQuery({ query: LISTS, data: { shoppingLists } });

    expect(cache.readQuery({ query: LISTS })).toEqual({
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        totalCount: 1,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: 'c1',
        },
        edges: [{ __typename: 'ShoppingListEdge', node: weekly }],
      },
    });
  });
});
