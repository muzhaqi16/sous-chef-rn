'use no memo';

// Mock the fragment matcher JSON before importing the module under test
jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {},
}));

import { gql, InMemoryCache } from '@apollo/client';
import { makeCache } from '../cache';
import { queueStore } from '../offlineQueue/queueStore';
import { QueueStatus } from '../offlineQueue/types';

type NodeRef = { __typename: string; id: string; name?: string };
type Edge = { __typename: string; node: NodeRef };
type Connection = {
  __typename: string;
  edges: Edge[];
  pageInfo: { __typename: string; hasNextPage: boolean; endCursor: string };
};
type HomeConnectionResult = {
  home: { __typename: string; id: string; shoppingListsConnection: Connection };
};
type ListItemsConnectionResult = {
  shoppingList: {
    __typename: string;
    id: string;
    itemsConnection: Connection;
  };
};
type PantryItemsConnectionResult = {
  pantry: { __typename: string; id: string; itemsConnection: Connection };
};
type ShoppingListsResult = { shoppingLists: NodeRef[] | null };
type PantriesResult = { pantries: NodeRef[] | null };
type StorageLocationsResult = { storageLocations: NodeRef[] | null };
type PantrySuggestionsResult = { pantryItemSuggestions: NodeRef[] | null };
type ListSuggestionsResult = {
  shoppingList: {
    __typename: string;
    id: string;
    suggestions: NodeRef[] | null;
  };
};
type MealPlanResult = {
  mealPlan: {
    __typename: string;
    id: string;
    mealPlanItems: {
      __typename: string;
      id: string;
      version: number;
      updatedAt: string;
      name: string;
    }[];
  };
};
type UserProfileFragmentResult = {
  __typename: string;
  id: string;
  profile: {
    __typename: string;
    id: string;
    displayName: string;
    avatar: string;
  };
};
type ItemFragmentResult = {
  __typename: string;
  id: string;
  name?: string;
  nutritions?: { calories: number };
  images?: { url: string; kind: string }[];
  imageUrl?: string | null;
};
type ShoppingListItemFragmentResult = {
  __typename: string;
  id: string;
  name?: string;
  version?: number;
};

describe('cache', () => {
  describe('makeCache', () => {
    it('returns an InMemoryCache instance', () => {
      const cache = makeCache();
      expect(cache).toBeInstanceOf(InMemoryCache);
    });
  });

  describe('mergeConnectionByNodeId (via Home.shoppingListsConnection)', () => {
    const HOME_QUERY_INITIAL = gql`
      query GetHome($id: ID!) {
        home(id: $id) {
          id
          shoppingListsConnection {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const HOME_QUERY_PAGINATED = gql`
      query GetHome($id: ID!, $after: String) {
        home(id: $id) {
          id
          shoppingListsConnection(after: $after) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    it('stores initial connection data', () => {
      const cache = makeCache();

      cache.writeQuery({
        query: HOME_QUERY_INITIAL,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: {
                    __typename: 'ShoppingList',
                    id: 'sl-1',
                    name: 'Groceries',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      const result = cache.readQuery<HomeConnectionResult>({
        query: HOME_QUERY_INITIAL,
        variables: { id: 'home-1' },
      });
      expect(result?.home.shoppingListsConnection.edges).toHaveLength(1);
    });

    it('deduplicates edges by node ID on pagination', () => {
      const cache = makeCache();

      // Initial load
      cache.writeQuery({
        query: HOME_QUERY_PAGINATED,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-1', name: 'A' },
                },
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-2', name: 'B' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Paginated load (with cursor)
      cache.writeQuery({
        query: HOME_QUERY_PAGINATED,
        variables: { id: 'home-1', after: 'c2' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: {
                    __typename: 'ShoppingList',
                    id: 'sl-2',
                    name: 'B-updated',
                  },
                },
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-3', name: 'C' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c3',
              },
            },
          },
        },
      });

      const result = cache.readQuery<HomeConnectionResult>({
        query: HOME_QUERY_PAGINATED,
        variables: { id: 'home-1' },
      });

      // sl-1, sl-2 (deduplicated with incoming), sl-3
      const edges = result?.home.shoppingListsConnection.edges ?? [];
      expect(edges).toHaveLength(3);
      const ids = edges.map((e: Edge) => e.node.id);
      expect(ids).toContain('sl-1');
      expect(ids).toContain('sl-2');
      expect(ids).toContain('sl-3');
    });
  });

  describe('mergeConnectionByNodeId - refetch preserves paginated items', () => {
    const HOME_QUERY = gql`
      query GetHome($id: ID!, $after: String) {
        home(id: $id) {
          id
          shoppingListsConnection(after: $after) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    it('preserves page 2 items when page 1 is refetched with hasNextPage:true', () => {
      const cache = makeCache();

      // Page 1 (initial load, no cursor)
      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-1', name: 'A' },
                },
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-2', name: 'B' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Page 2 (paginated with cursor)
      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1', after: 'c2' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-3', name: 'C' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c3',
              },
            },
          },
        },
      });

      // Verify all 3 items exist
      let result = cache.readQuery<HomeConnectionResult>({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
      });
      expect(result?.home.shoppingListsConnection.edges).toHaveLength(3);

      // Refetch page 1 (no cursor, hasNextPage: true) — should NOT wipe page 2
      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-1', name: 'A' },
                },
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-2', name: 'B' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      result = cache.readQuery<HomeConnectionResult>({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
      });
      const ids = result?.home.shoppingListsConnection.edges.map(
        (e: Edge) => e.node.id,
      );
      expect(ids).toContain('sl-1');
      expect(ids).toContain('sl-2');
      expect(ids).toContain('sl-3');
    });

    it('replaces entirely when refetch has hasNextPage:false (all items fit in one page)', () => {
      const cache = makeCache();

      // Initial multi-page load
      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-1', name: 'A' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1', after: 'c1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-2', name: 'B' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Refetch with hasNextPage:false — items were deleted, only 1 remains
      cache.writeQuery({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: {
              __typename: 'ShoppingListsConnection',
              edges: [
                {
                  __typename: 'ShoppingListEdge',
                  node: { __typename: 'ShoppingList', id: 'sl-1', name: 'A' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      const result = cache.readQuery<HomeConnectionResult>({
        query: HOME_QUERY,
        variables: { id: 'home-1' },
      });
      // sl-2 should be gone since all items fit in one page now
      expect(result?.home.shoppingListsConnection.edges).toHaveLength(1);
      expect(result?.home.shoppingListsConnection.edges[0].node.id).toBe(
        'sl-1',
      );
    });
  });

  describe('itemsConnectionFieldPolicy (via ShoppingList.itemsConnection)', () => {
    // Need to add ShoppingList to the cache first - write via cache directly
    it('stores initial connection data', () => {
      const cache = makeCache();

      cache.writeQuery({
        query: gql`
          query GetList($id: ID!) {
            shoppingList(id: $id) {
              id
              itemsConnection {
                edges {
                  node {
                    id
                    name
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'item-1',
                    name: 'Milk',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      const result = cache.readQuery<ListItemsConnectionResult>({
        query: gql`
          query GetList($id: ID!) {
            shoppingList(id: $id) {
              id
              itemsConnection {
                edges {
                  node {
                    id
                    name
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `,
        variables: { id: 'list-1' },
      });

      expect(result?.shoppingList.itemsConnection.edges).toHaveLength(1);
    });

    const SINGLE_PAGE_QUERY = gql`
      query GetList($id: ID!) {
        shoppingList(id: $id) {
          id
          itemsConnection {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const writeSinglePage = (
      cache: InMemoryCache,
      nodes: { id: string; name: string }[],
    ) =>
      cache.writeQuery({
        query: SINGLE_PAGE_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: nodes.map(n => ({
                __typename: 'ShoppingListItemEdge',
                node: { __typename: 'ShoppingListItem', ...n },
              })),
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: '',
              },
            },
          },
        },
      });

    const readIds = (cache: InMemoryCache): string[] =>
      cache
        .readQuery<ListItemsConnectionResult>({
          query: SINGLE_PAGE_QUERY,
          variables: { id: 'list-1' },
        })
        ?.shoppingList.itemsConnection.edges.map(e => e.node.id) ?? [];

    it('preserves an un-replayed local edge over an authoritative single-page refetch', () => {
      const spy = jest
        .spyOn(queueStore, 'getPendingClientIds')
        .mockReturnValue(new Set(['cuid-pending']));
      const cache = makeCache();

      // Initial: a server item + an offline-created (still-queued) item.
      writeSinglePage(cache, [
        { id: 'server-1', name: 'Eggs' },
        { id: 'cuid-pending', name: 'Milk' },
      ]);
      // Authoritative refetch that doesn't yet include the un-replayed item.
      writeSinglePage(cache, [{ id: 'server-1', name: 'Eggs' }]);

      // The pending local item is kept (its create is still queued).
      expect(readIds(cache)).toEqual(
        expect.arrayContaining(['server-1', 'cuid-pending']),
      );
      expect(readIds(cache)).toHaveLength(2);
      spy.mockRestore();
    });

    it('drops a server-removed edge that has no pending mutation', () => {
      const spy = jest
        .spyOn(queueStore, 'getPendingClientIds')
        .mockReturnValue(new Set()); // nothing queued
      const cache = makeCache();

      writeSinglePage(cache, [
        { id: 'server-1', name: 'Eggs' },
        { id: 'gone-1', name: 'Deleted elsewhere' },
      ]);
      // Authoritative refetch no longer has gone-1 (e.g. a collaborator deleted
      // it). With no pending op for it, the page stays authoritative → dropped.
      writeSinglePage(cache, [{ id: 'server-1', name: 'Eggs' }]);

      expect(readIds(cache)).toEqual(['server-1']);
      spy.mockRestore();
    });

    it('preserves an offline batch-add edge through a REAL queue entry (no spy)', () => {
      // Cross-seam: the merge guard's real getPendingClientIds() must extract
      // the client id from the batch AddItemsToShoppingListInput shape every
      // shopping-list add enqueues — a drift in that id-shape contract passes
      // the spy-based tests above and the queueStore unit tests while still
      // dropping offline adds in production.
      queueStore.setCurrentUserId('cross-seam-user');
      queueStore.addMutation({
        id: 'cross-seam-batch-add',
        userId: 'cross-seam-user',
        operationName: 'AddItemsToShoppingList',
        mutation: gql`
          mutation AddItemsToShoppingList {
            __typename
          }
        `,
        variables: {
          input: {
            shoppingListId: 'list-1',
            items: [{ id: 'cuid-batch-pending', name: 'Milk' }],
          },
        },
        status: QueueStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        requiresAuth: true,
      });

      const cache = makeCache();
      writeSinglePage(cache, [
        { id: 'server-1', name: 'Eggs' },
        { id: 'cuid-batch-pending', name: 'Milk' },
      ]);
      // Authoritative refetch lands before the queue drains the create.
      writeSinglePage(cache, [{ id: 'server-1', name: 'Eggs' }]);

      expect(readIds(cache)).toEqual(
        expect.arrayContaining(['server-1', 'cuid-batch-pending']),
      );
      expect(readIds(cache)).toHaveLength(2);

      queueStore.clearAllQueues();
      queueStore.clearCurrentUserId();
    });
  });

  describe('Query-level simple merge policies', () => {
    it('Query.shoppingLists preserves existing on null incoming', () => {
      const cache = makeCache();

      const QUERY = gql`
        query GetLists($filters: ShoppingListFilters) {
          shoppingLists(filters: $filters) {
            id
            name
          }
        }
      `;

      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
        data: {
          shoppingLists: [
            { __typename: 'ShoppingList', id: 'sl-1', name: 'Groceries' },
          ],
        },
      });

      // Writing null should preserve existing
      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
        data: {
          shoppingLists: null,
        },
      });

      const result = cache.readQuery<ShoppingListsResult>({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
      });
      expect(result?.shoppingLists).toHaveLength(1);
    });

    it('Query.shoppingLists replaces on empty array', () => {
      const cache = makeCache();

      const QUERY = gql`
        query GetLists($filters: ShoppingListFilters) {
          shoppingLists(filters: $filters) {
            id
            name
          }
        }
      `;

      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
        data: {
          shoppingLists: [
            { __typename: 'ShoppingList', id: 'sl-1', name: 'Groceries' },
          ],
        },
      });

      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
        data: {
          shoppingLists: [],
        },
      });

      const result = cache.readQuery<ShoppingListsResult>({
        query: QUERY,
        variables: { filters: { homeId: 'h1' } },
      });
      expect(result?.shoppingLists).toEqual([]);
    });
  });

  describe('Query-level pantries merge policy', () => {
    const PANTRIES_QUERY = gql`
      query GetPantries($homeId: ID!) {
        pantries(homeId: $homeId) {
          id
          name
        }
      }
    `;

    it('preserves existing pantries on null incoming', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
        data: {
          pantries: [{ __typename: 'Pantry', id: 'p1', name: 'Kitchen' }],
        },
      });
      cache.writeQuery({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
        data: { pantries: null },
      });
      const result = cache.readQuery<PantriesResult>({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
      });
      expect(result?.pantries).toHaveLength(1);
    });

    it('replaces pantries on incoming data', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
        data: {
          pantries: [{ __typename: 'Pantry', id: 'p1', name: 'Kitchen' }],
        },
      });
      cache.writeQuery({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
        data: {
          pantries: [{ __typename: 'Pantry', id: 'p2', name: 'Garage' }],
        },
      });
      const result = cache.readQuery<PantriesResult>({
        query: PANTRIES_QUERY,
        variables: { homeId: 'h1' },
      });
      expect(result?.pantries).toHaveLength(1);
      expect(result?.pantries?.[0].name).toBe('Garage');
    });
  });

  describe('Query-level storageLocations merge policy', () => {
    const STORAGE_QUERY = gql`
      query GetStorageLocations($homeId: ID!) {
        storageLocations(homeId: $homeId) {
          id
          name
        }
      }
    `;

    it('preserves existing on null incoming', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: STORAGE_QUERY,
        variables: { homeId: 'h1' },
        data: {
          storageLocations: [
            { __typename: 'StorageLocation', id: 's1', name: 'Fridge' },
          ],
        },
      });
      cache.writeQuery({
        query: STORAGE_QUERY,
        variables: { homeId: 'h1' },
        data: { storageLocations: null },
      });
      const result = cache.readQuery<StorageLocationsResult>({
        query: STORAGE_QUERY,
        variables: { homeId: 'h1' },
      });
      expect(result?.storageLocations).toHaveLength(1);
    });
  });

  describe('Query-level suggestions merge policies', () => {
    const PANTRY_SUGGESTIONS_QUERY = gql`
      query GetSuggestions($pantryId: ID!) {
        pantryItemSuggestions(pantryId: $pantryId) {
          id
          name
        }
      }
    `;

    it('preserves pantry suggestions on null', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
        data: {
          pantryItemSuggestions: [
            { __typename: 'PantryItem', id: 'ps1', name: 'Milk' },
          ],
        },
      });
      cache.writeQuery({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
        data: { pantryItemSuggestions: null },
      });
      const result = cache.readQuery<PantrySuggestionsResult>({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
      });
      expect(result?.pantryItemSuggestions).toHaveLength(1);
    });

    it('replaces pantry suggestions with incoming', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
        data: {
          pantryItemSuggestions: [
            { __typename: 'PantryItem', id: 'ps1', name: 'Milk' },
          ],
        },
      });
      cache.writeQuery({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
        data: {
          pantryItemSuggestions: [
            { __typename: 'PantryItem', id: 'ps2', name: 'Eggs' },
          ],
        },
      });
      const result = cache.readQuery<PantrySuggestionsResult>({
        query: PANTRY_SUGGESTIONS_QUERY,
        variables: { pantryId: 'p1' },
      });
      expect(result?.pantryItemSuggestions).toHaveLength(1);
      expect(result?.pantryItemSuggestions?.[0].name).toBe('Eggs');
    });
  });

  describe('ShoppingList.suggestions merge', () => {
    const LIST_SUGGESTIONS_QUERY = gql`
      query GetListSuggestions($id: ID!) {
        shoppingList(id: $id) {
          id
          suggestions {
            id
            name
          }
        }
      }
    `;

    it('preserves existing suggestions on null incoming', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: LIST_SUGGESTIONS_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            suggestions: [
              { __typename: 'ShoppingListItem', id: 'sug-1', name: 'Butter' },
            ],
          },
        },
      });
      cache.writeQuery({
        query: LIST_SUGGESTIONS_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            suggestions: null,
          },
        },
      });
      const result = cache.readQuery<ListSuggestionsResult>({
        query: LIST_SUGGESTIONS_QUERY,
        variables: { id: 'list-1' },
      });
      expect(result?.shoppingList.suggestions).toHaveLength(1);
    });
  });

  describe('Pantry.itemsConnection - refetch preserves paginated items', () => {
    const PANTRY_CONNECTION_QUERY = gql`
      query GetPantryItems($id: ID!, $after: String) {
        pantry(id: $id) {
          id
          itemsConnection(after: $after) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    it('preserves page 2 items when page 1 is refetched with hasNextPage:true', () => {
      const cache = makeCache();

      // Page 1
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-2', name: 'Sugar' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Page 2 (with cursor)
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1', after: 'c2' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: {
                    __typename: 'PantryItem',
                    id: 'pi-3',
                    name: 'Olive Oil',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c3',
              },
            },
          },
        },
      });

      // Verify all 3 items
      let result = cache.readQuery<PantryItemsConnectionResult>({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
      });
      expect(result?.pantry.itemsConnection.edges).toHaveLength(3);

      // Refetch page 1 (no cursor, hasNextPage:true) — must NOT wipe Olive Oil
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-2', name: 'Sugar' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      result = cache.readQuery<PantryItemsConnectionResult>({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
      });
      const ids = result?.pantry.itemsConnection.edges.map(
        (e: Edge) => e.node.id,
      );
      expect(ids).toContain('pi-1');
      expect(ids).toContain('pi-2');
      expect(ids).toContain('pi-3');
    });

    it('replaces entirely when refetch has hasNextPage:false', () => {
      const cache = makeCache();

      // Initial load
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      // Page 2
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1', after: 'c1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-2', name: 'Sugar' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Refetch — items deleted, all fit in one page (hasNextPage:false)
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      const result = cache.readQuery<PantryItemsConnectionResult>({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
      });
      expect(result?.pantry.itemsConnection.edges).toHaveLength(1);
      expect(result?.pantry.itemsConnection.edges[0].node.id).toBe('pi-1');
    });
  });

  describe('Pantry.itemsConnection - resilience guard (connection blip)', () => {
    const PANTRY_CONNECTION_QUERY = gql`
      query GetPantryItems($id: ID!, $after: String) {
        pantry(id: $id) {
          id
          itemsConnection(after: $after) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const PANTRY_CONNECTION_QUERY_WITH_COUNT = gql`
      query GetPantryItemsCount($id: ID!, $after: String) {
        pantry(id: $id) {
          id
          itemsConnection(after: $after) {
            totalCount
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    it('preserves cached items when a refetch returns an EMPTY/partial connection (no authoritative totalCount)', () => {
      const cache = makeCache();

      // Initial single-page load: 2 items cached
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-2', name: 'Sugar' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      // Transient/partial refetch (connection blip): no cursor, hasNextPage:false,
      // EMPTY edges, and no authoritative totalCount. Must NOT wipe the cache.
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      });

      const result = cache.readQuery<PantryItemsConnectionResult>({
        query: PANTRY_CONNECTION_QUERY,
        variables: { id: 'p1' },
      });
      // The cached pantry survives the connection blip.
      expect(result?.pantry.itemsConnection.edges).toHaveLength(2);
    });

    it('honors an AUTHORITATIVE empty list (totalCount: 0) and clears the connection', () => {
      const cache = makeCache();

      // Initial load: 2 items, totalCount 2
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY_WITH_COUNT,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              totalCount: 2,
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-1', name: 'Flour' },
                },
                {
                  __typename: 'PantryItemEdge',
                  node: { __typename: 'PantryItem', id: 'pi-2', name: 'Sugar' },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      // Server authoritatively reports an empty list (everything removed).
      cache.writeQuery({
        query: PANTRY_CONNECTION_QUERY_WITH_COUNT,
        variables: { id: 'p1' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            itemsConnection: {
              __typename: 'PantryItemsConnection',
              totalCount: 0,
              edges: [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      });

      const result = cache.readQuery<PantryItemsConnectionResult>({
        query: PANTRY_CONNECTION_QUERY_WITH_COUNT,
        variables: { id: 'p1' },
      });
      // Authoritative empty is honored — the list clears.
      expect(result?.pantry.itemsConnection.edges).toHaveLength(0);
    });
  });

  describe('itemsConnectionFieldPolicy - refetch preserves paginated items', () => {
    const LIST_CONNECTION_QUERY = gql`
      query GetList($id: ID!, $after: String) {
        shoppingList(id: $id) {
          id
          itemsConnection(after: $after) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    it('preserves page 2 items when page 1 is refetched with hasNextPage:true', () => {
      const cache = makeCache();

      // Page 1
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-1',
                    name: 'Milk',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      // Page 2 (with cursor)
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1', after: 'c1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-2',
                    name: 'Bread',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Verify both pages present
      let result = cache.readQuery<ListItemsConnectionResult>({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
      });
      expect(result?.shoppingList.itemsConnection.edges).toHaveLength(2);

      // Refetch page 1 (no cursor, hasNextPage:true) — must preserve page 2
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-1',
                    name: 'Milk',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      result = cache.readQuery<ListItemsConnectionResult>({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
      });
      const ids = result?.shoppingList.itemsConnection.edges.map(
        (e: Edge) => e.node.id,
      );
      expect(ids).toContain('si-1');
      expect(ids).toContain('si-2');
    });

    it('replaces entirely when refetch has hasNextPage:false', () => {
      const cache = makeCache();

      // Page 1
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-1',
                    name: 'Milk',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: true,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      // Page 2
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1', after: 'c1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-2',
                    name: 'Bread',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c2',
              },
            },
          },
        },
      });

      // Refetch — all fits in one page now
      cache.writeQuery({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: {
              __typename: 'ShoppingListItemsConnection',
              edges: [
                {
                  __typename: 'ShoppingListItemEdge',
                  node: {
                    __typename: 'ShoppingListItem',
                    id: 'si-1',
                    name: 'Milk',
                  },
                },
              ],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                endCursor: 'c1',
              },
            },
          },
        },
      });

      const result = cache.readQuery<ListItemsConnectionResult>({
        query: LIST_CONNECTION_QUERY,
        variables: { id: 'list-1' },
      });
      expect(result?.shoppingList.itemsConnection.edges).toHaveLength(1);
      expect(result?.shoppingList.itemsConnection.edges[0].node.id).toBe(
        'si-1',
      );
    });
  });

  describe('MealPlan.mealPlanItems merge', () => {
    const MEAL_PLAN_QUERY = gql`
      query GetMealPlan($id: ID!) {
        mealPlan(id: $id) {
          id
          mealPlanItems {
            id
            version
            updatedAt
            name
          }
        }
      }
    `;

    it('uses intelligent merge for meal plan items', () => {
      const cache = makeCache();
      cache.writeQuery({
        query: MEAL_PLAN_QUERY,
        variables: { id: 'mp1' },
        data: {
          mealPlan: {
            __typename: 'MealPlan',
            id: 'mp1',
            mealPlanItems: [
              {
                __typename: 'MealPlanItem',
                id: 'mpi-1',
                version: 1,
                updatedAt: '2024-01-01',
                name: 'Monday Dinner',
              },
            ],
          },
        },
      });
      cache.writeQuery({
        query: MEAL_PLAN_QUERY,
        variables: { id: 'mp1' },
        data: {
          mealPlan: {
            __typename: 'MealPlan',
            id: 'mp1',
            mealPlanItems: [
              {
                __typename: 'MealPlanItem',
                id: 'mpi-1',
                version: 2,
                updatedAt: '2024-01-02',
                name: 'Monday Dinner Updated',
              },
              {
                __typename: 'MealPlanItem',
                id: 'mpi-2',
                version: 1,
                updatedAt: '2024-01-02',
                name: 'Tuesday Lunch',
              },
            ],
          },
        },
      });
      const result = cache.readQuery<MealPlanResult>({
        query: MEAL_PLAN_QUERY,
        variables: { id: 'mp1' },
      });
      expect(result?.mealPlan.mealPlanItems).toHaveLength(2);
    });

    const readItemIds = (cache: ReturnType<typeof makeCache>) =>
      cache
        .readQuery<MealPlanResult>({
          query: MEAL_PLAN_QUERY,
          variables: { id: 'mp1' },
        })
        ?.mealPlan.mealPlanItems.map(i => i.id) ?? [];

    const writeItems = (
      cache: ReturnType<typeof makeCache>,
      items: Array<{ id: string; name: string }>,
    ) =>
      cache.writeQuery({
        query: MEAL_PLAN_QUERY,
        variables: { id: 'mp1' },
        data: {
          mealPlan: {
            __typename: 'MealPlan',
            id: 'mp1',
            mealPlanItems: items.map(i => ({
              __typename: 'MealPlanItem',
              id: i.id,
              version: 1,
              updatedAt: '2024-01-01',
              name: i.name,
            })),
          },
        },
      });

    it('preserves an un-replayed local meal item over an authoritative refetch', () => {
      const spy = jest
        .spyOn(queueStore, 'getPendingClientIds')
        .mockReturnValue(new Set(['mpi-local']));
      const cache = makeCache();

      writeItems(cache, [
        { id: 'mpi-server', name: 'Monday Dinner' },
        { id: 'mpi-local', name: 'Tuesday Lunch (offline)' },
      ]);
      // Refetch that doesn't yet include the still-queued local item.
      writeItems(cache, [{ id: 'mpi-server', name: 'Monday Dinner' }]);

      expect(readItemIds(cache)).toEqual(
        expect.arrayContaining(['mpi-server', 'mpi-local']),
      );
      expect(readItemIds(cache)).toHaveLength(2);
      spy.mockRestore();
    });

    it('drops a server-removed meal item with no pending mutation', () => {
      const spy = jest
        .spyOn(queueStore, 'getPendingClientIds')
        .mockReturnValue(new Set());
      const cache = makeCache();

      writeItems(cache, [
        { id: 'mpi-server', name: 'Monday Dinner' },
        { id: 'mpi-gone', name: 'Deleted elsewhere' },
      ]);
      writeItems(cache, [{ id: 'mpi-server', name: 'Monday Dinner' }]);

      expect(readItemIds(cache)).toEqual(['mpi-server']);
      spy.mockRestore();
    });
  });

  describe('User.profile merge', () => {
    it('merges partial profile updates', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'User:user-1',
        fragment: gql`
          fragment UserProfile on User {
            id
            profile {
              displayName
              avatar
            }
          }
        `,
        data: {
          __typename: 'User',
          id: 'user-1',
          profile: {
            __typename: 'UserProfile',
            id: 'profile-1',
            displayName: 'John',
            avatar: 'avatar.jpg',
          },
        },
      });
      // Write another partial profile update
      cache.writeFragment({
        id: 'User:user-1',
        fragment: gql`
          fragment UserProfileUpdate on User {
            id
            profile {
              displayName
            }
          }
        `,
        data: {
          __typename: 'User',
          id: 'user-1',
          profile: {
            __typename: 'UserProfile',
            id: 'profile-1',
            displayName: 'John Updated',
          },
        },
      });
      const result = cache.readFragment<UserProfileFragmentResult>({
        id: 'User:user-1',
        fragment: gql`
          fragment UserProfileFull on User {
            id
            profile {
              displayName
              avatar
            }
          }
        `,
      });
      expect(result?.profile.displayName).toBe('John Updated');
      expect(result?.profile.avatar).toBe('avatar.jpg');
    });
  });

  describe('Item field merge policies', () => {
    it('Item.nutritions preserves existing when incoming is undefined', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemNutritions on Item {
            id
            nutritions
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          nutritions: { calories: 100 },
        },
      });
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemNameOnly on Item {
            id
            name
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Updated Name',
        },
      });
      const result = cache.readFragment<ItemFragmentResult>({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemFull on Item {
            id
            name
            nutritions
          }
        `,
      });
      expect(result?.name).toBe('Updated Name');
      expect(result?.nutritions).toEqual({ calories: 100 });
    });

    it('Item.images preserves existing when incoming is undefined', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemImages on Item {
            id
            images
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          images: [{ url: 'test.jpg', kind: 'MAIN' }],
        },
      });
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemNameOnly on Item {
            id
            name
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Updated',
        },
      });
      const result = cache.readFragment<ItemFragmentResult>({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemAllFields on Item {
            id
            name
            images
          }
        `,
      });
      expect(result?.name).toBe('Updated');
      expect(result?.images).toEqual([{ url: 'test.jpg', kind: 'MAIN' }]);
    });

    it('Item.imageUrl allows explicit null to remove image', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemWithImage on Item {
            id
            imageUrl
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          imageUrl: 'https://example.com/img.jpg',
        },
      });
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemRemoveImage on Item {
            id
            imageUrl
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          imageUrl: null,
        },
      });
      const result = cache.readFragment<ItemFragmentResult>({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemCheck on Item {
            id
            imageUrl
          }
        `,
      });
      expect(result?.imageUrl).toBeNull();
    });
  });

  describe('entity type policies', () => {
    it('ShoppingListItem uses id as key field and merge:true for field-level merge', () => {
      const cache = makeCache();

      // Write partial data
      cache.writeFragment({
        id: 'ShoppingListItem:item-1',
        fragment: gql`
          fragment ItemPartial on ShoppingListItem {
            id
            name
          }
        `,
        data: {
          __typename: 'ShoppingListItem',
          id: 'item-1',
          name: 'Milk',
        },
      });

      // Write more fields for the same entity (merge:true allows field-level merge)
      cache.writeFragment({
        id: 'ShoppingListItem:item-1',
        fragment: gql`
          fragment ItemVersion on ShoppingListItem {
            id
            version
          }
        `,
        data: {
          __typename: 'ShoppingListItem',
          id: 'item-1',
          version: 2,
        },
      });

      // Both fields should be present (merge:true enables field-level merging)
      const result = cache.readFragment<ShoppingListItemFragmentResult>({
        id: 'ShoppingListItem:item-1',
        fragment: gql`
          fragment ItemMerged on ShoppingListItem {
            id
            name
            version
          }
        `,
      });

      expect(result?.name).toBe('Milk');
      expect(result?.version).toBe(2);
    });

    it('Item.imageUrl preserves existing when incoming is undefined', () => {
      const cache = makeCache();

      // Write item with imageUrl
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemWithImage on Item {
            id
            name
            imageUrl
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Banana',
          imageUrl: 'https://example.com/banana.jpg',
        },
      });

      // Write item without imageUrl (imageUrl not in fragment, so not touched)
      cache.writeFragment({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemNameOnly on Item {
            id
            name
          }
        `,
        data: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Banana Updated',
        },
      });

      // imageUrl should still be preserved
      const result = cache.readFragment<ItemFragmentResult>({
        id: 'Item:item-1',
        fragment: gql`
          fragment ItemWithAllFields on Item {
            id
            name
            imageUrl
          }
        `,
      });

      expect(result?.name).toBe('Banana Updated');
      expect(result?.imageUrl).toBe('https://example.com/banana.jpg');
    });
  });
});
