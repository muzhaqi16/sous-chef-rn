/**
 * Real-InMemoryCache integration tests for the shopping list local-first
 * create path: the optimistic entity write, the seeded empty itemsConnection
 * variants, the `Query.shoppingList` by-id cache redirect, and the revert.
 * Uses the production cache config (`makeCache`) so type policies — keyArgs,
 * the redirect, connection merges — are the real ones.
 */

import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  addOptimisticShoppingList,
  buildOptimisticShoppingList,
  revertOptimisticShoppingList,
} from '../list';

const LISTS_OVERVIEW_QUERY = gql`
  query TestShoppingLists($homeId: ID) {
    shoppingLists(filters: { homeId: $homeId }) {
      totalCount
      edges {
        cursor
        node {
          id
          name
          isDefault
        }
      }
    }
  }
`;

const LIST_BY_ID_QUERY = gql`
  query TestShoppingList($id: ID!) {
    shoppingList(id: $id) {
      id
      name
      itemsConnection(filters: { isPurchased: false }) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
        }
      }
    }
  }
`;

const TEMPLATES_QUERY = gql`
  query TestShoppingListTemplates {
    shoppingLists(filters: { isTemplate: true }) {
      totalCount
      edges {
        cursor
        node {
          id
          name
          templateName
        }
      }
    }
  }
`;

const OWNER = { id: 'user-1', email: 'tani@example.com' };
const LIST_ID = 'c0000000000000000000list1';

function seedEmptyOverview(cache: ReturnType<typeof makeCache>) {
  cache.writeQuery({
    query: LISTS_OVERVIEW_QUERY,
    variables: { homeId: null },
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        totalCount: 0,
        edges: [],
      },
    },
  });
}

function buildList(
  cache: ReturnType<typeof makeCache>,
  input: { name: string; isDefault?: boolean; homeId?: string } = {
    name: 'Groceries',
  },
) {
  return buildOptimisticShoppingList(cache, LIST_ID, input, OWNER);
}

describe('buildOptimisticShoppingList', () => {
  it('materializes owner display data from the cached canonical User entity', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: cache.identify({ __typename: 'User', id: OWNER.id }),
      fragment: gql`
        fragment TestUser on User {
          id
          email
          profile {
            id
            displayName
            avatar
          }
        }
      `,
      data: {
        __typename: 'User',
        id: OWNER.id,
        email: OWNER.email,
        profile: {
          __typename: 'UserProfile',
          id: 'profile-1',
          displayName: 'Tani',
          avatar: 'https://a.example/x.png',
        },
      },
    });

    const list = buildList(cache);

    expect(list.ownerships).toHaveLength(1);
    expect(list.ownerships[0].userId).toBe(OWNER.id);
    expect(list.ownerships[0].user.profile?.displayName).toBe('Tani');
  });

  it('falls back to the auth identity with a null profile when the User entity is not cached', () => {
    const list = buildList(makeCache());

    expect(list.ownerships[0].user).toEqual({
      __typename: 'User',
      id: OWNER.id,
      email: OWNER.email,
      profile: null,
    });
  });

  it('resolves the linked home name from cache and degrades to null when missing', () => {
    const cache = makeCache();
    cache.writeFragment({
      id: cache.identify({ __typename: 'Home', id: 'home-1' }),
      fragment: gql`
        fragment TestHome on Home {
          id
          name
        }
      `,
      data: { __typename: 'Home', id: 'home-1', name: 'Casa' },
    });

    const linked = buildList(cache, { name: 'Groceries', homeId: 'home-1' });
    expect(linked.home).toEqual({
      __typename: 'Home',
      id: 'home-1',
      name: 'Casa',
    });

    const unknownHome = buildList(cache, {
      name: 'Groceries',
      homeId: 'home-9',
    });
    expect(unknownHome.home).toBeNull();
    expect(unknownHome.homeId).toBe('home-9');
  });
});

describe('addOptimisticShoppingList', () => {
  it('leaves the templates connection alone — a new list is never a template', () => {
    // `Query.shoppingLists` is keyed by `filters`, and a cache.modify write
    // fans out across every variant. The template picker's variant selects
    // `templateName`, which an optimistic list has no value for, so a leaked
    // edge would make the whole read incomplete and blank the picker.
    const cache = makeCache();
    seedEmptyOverview(cache);
    cache.writeQuery({
      query: TEMPLATES_QUERY,
      data: {
        shoppingLists: {
          __typename: 'ShoppingListConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'ShoppingListEdge',
              cursor: 'tpl-cursor',
              node: {
                __typename: 'ShoppingList',
                id: 'template-1',
                name: 'Weekly Groceries',
                templateName: 'Weekly Staples',
              },
            },
          ],
        },
      },
    });

    addOptimisticShoppingList(cache, buildList(cache));

    const templates = cache.readQuery<{
      shoppingLists: {
        totalCount: number;
        edges: Array<{ node: { id: string } }>;
      };
    }>({ query: TEMPLATES_QUERY });
    expect(templates?.shoppingLists.totalCount).toBe(1);
    expect(templates?.shoppingLists.edges.map(e => e.node.id)).toEqual([
      'template-1',
    ]);
  });

  it('adds the list to the cached overview connection', () => {
    const cache = makeCache();
    seedEmptyOverview(cache);

    addOptimisticShoppingList(cache, buildList(cache));

    const overview = cache.readQuery<{
      shoppingLists: {
        totalCount: number;
        edges: Array<{ node: { id: string; name: string } }>;
      };
    }>({ query: LISTS_OVERVIEW_QUERY, variables: { homeId: null } });
    expect(overview?.shoppingLists.totalCount).toBe(1);
    expect(overview?.shoppingLists.edges[0].node).toMatchObject({
      id: LIST_ID,
      name: 'Groceries',
    });
  });

  it('serves by-id lookups through the Query.shoppingList redirect with seeded empty itemsConnection variants', () => {
    const cache = makeCache();

    addOptimisticShoppingList(cache, buildList(cache));

    // No server response ever wrote ROOT_QUERY.shoppingList({id}) — the
    // redirect resolves the normalized entity, and the seeded variant makes
    // the items screen's read complete (offline-renderable).
    const detail = cache.readQuery<{
      shoppingList: {
        id: string;
        name: string;
        itemsConnection: { totalCount: number; edges: unknown[] };
      };
    }>({ query: LIST_BY_ID_QUERY, variables: { id: LIST_ID } });
    expect(detail?.shoppingList.id).toBe(LIST_ID);
    expect(detail?.shoppingList.itemsConnection.totalCount).toBe(0);
    expect(detail?.shoppingList.itemsConnection.edges).toEqual([]);
  });

  it('does not redirect unknown ids to a dangling reference', () => {
    const cache = makeCache();

    const detail = cache.readQuery({
      query: LIST_BY_ID_QUERY,
      variables: { id: 'c0000000000000000unknown1' },
    });
    expect(detail).toBeNull();
  });
});

describe('revertOptimisticShoppingList', () => {
  it('removes the overview edge and evicts the entity', () => {
    const cache = makeCache();
    seedEmptyOverview(cache);
    addOptimisticShoppingList(cache, buildList(cache));

    revertOptimisticShoppingList(cache, LIST_ID);

    const overview = cache.readQuery<{
      shoppingLists: { totalCount: number; edges: unknown[] };
    }>({ query: LISTS_OVERVIEW_QUERY, variables: { homeId: null } });
    expect(overview?.shoppingLists.totalCount).toBe(0);
    expect(overview?.shoppingLists.edges).toEqual([]);

    const detail = cache.readQuery({
      query: LIST_BY_ID_QUERY,
      variables: { id: LIST_ID },
    });
    expect(detail).toBeNull();
  });
});
