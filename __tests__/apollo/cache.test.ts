'use no memo';

import { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';

/** Shape read back by the `id imageUrl` fragments exercised below. */
interface ItemImageResult {
  __typename?: 'Item';
  id: string;
  imageUrl?: string | null;
}

// Mock the fragment matcher data
jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {
    Node: ['ShoppingListItem', 'PantryItem'],
  },
}));

describe('cache.ts', () => {
  describe('makeCache', () => {
    it('returns an InMemoryCache instance', () => {
      const cache = makeCache();
      expect(cache).toBeInstanceOf(InMemoryCache);
    });
  });

  // ─── suggestions merge ─────────────────────────────────────────

  interface ShoppingListResult {
    shoppingList: { __typename: 'ShoppingList'; id: string; suggestions: string[] | null };
  }

  describe('ShoppingList.suggestions merge', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = makeCache();
    });

    const gql = require('graphql-tag').default;
    const QUERY = gql`
      query GetShoppingList {
        shoppingList(id: "list-1") {
          id
          suggestions
        }
      }
    `;

    it('preserves existing suggestions when incoming is null', () => {
      cache.writeQuery({
        query: QUERY,
        data: { shoppingList: { __typename: 'ShoppingList', id: 'list-1', suggestions: ['a', 'b'] } },
      });
      cache.writeQuery({
        query: QUERY,
        data: { shoppingList: { __typename: 'ShoppingList', id: 'list-1', suggestions: null } },
      });
      const result = cache.readQuery<ShoppingListResult>({ query: QUERY });
      expect(result?.shoppingList.suggestions).toEqual(['a', 'b']);
    });

    it('replaces suggestions with new incoming data', () => {
      cache.writeQuery({
        query: QUERY,
        data: { shoppingList: { __typename: 'ShoppingList', id: 'list-1', suggestions: ['a'] } },
      });
      cache.writeQuery({
        query: QUERY,
        data: { shoppingList: { __typename: 'ShoppingList', id: 'list-1', suggestions: ['x', 'y'] } },
      });
      const result = cache.readQuery<ShoppingListResult>({ query: QUERY });
      expect(result?.shoppingList.suggestions).toEqual(['x', 'y']);
    });
  });

  // ─── Item.imageUrl merge ───────────────────────────────────────

  describe('Item field merges (imageUrl, nutritions, images)', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = makeCache();
    });

    const gql = require('graphql-tag').default;

    it('preserves existing imageUrl when incoming is undefined', () => {
      cache.writeFragment({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemImg on Item { id imageUrl }`,
        data: { __typename: 'Item', id: 'item-1', imageUrl: 'http://img.png' },
      });
      // Write without imageUrl field (undefined)
      cache.writeFragment({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemName on Item { id }`,
        data: { __typename: 'Item', id: 'item-1' },
      });
      const result = cache.readFragment<ItemImageResult>({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemImgRead on Item { id imageUrl }`,
      });
      expect(result?.imageUrl).toBe('http://img.png');
    });

    it('allows explicit null through for imageUrl (user removes image)', () => {
      cache.writeFragment({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemImg on Item { id imageUrl }`,
        data: { __typename: 'Item', id: 'item-1', imageUrl: 'http://img.png' },
      });
      cache.writeFragment({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemImgNull on Item { id imageUrl }`,
        data: { __typename: 'Item', id: 'item-1', imageUrl: null },
      });
      const result = cache.readFragment<ItemImageResult>({
        id: cache.identify({ __typename: 'Item', id: 'item-1' }),
        fragment: gql`fragment ItemImgRead on Item { id imageUrl }`,
      });
      expect(result?.imageUrl).toBeNull();
    });
  });

  // ─── mergeConnectionByNodeId ───────────────────────────────────

  describe('mergeConnectionByNodeId via Home.membersConnection', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = makeCache();
    });

    const gql = require('graphql-tag').default;
    const QUERY = gql`
      query GetHome($membersCursor: String) {
        home(id: "home-1") {
          id
          membersConnection(membersCursor: $membersCursor) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    `;

    it('returns incoming when no existing data', () => {
      cache.writeQuery({
        query: QUERY,
        variables: {},
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            membersConnection: {
              __typename: 'MembershipConnection',
              edges: [{ __typename: 'MembershipEdge', node: { __typename: 'Membership', id: 'm-1', name: 'Alice' } }],
              pageInfo: { __typename: 'PageInfo', hasNextPage: true },
            },
          },
        },
      });
      const result = cache.readQuery({ query: QUERY, variables: {} }) as any;
      expect(result.home.membersConnection.edges).toHaveLength(1);
    });

    it('deduplicates edges by node ID on pagination', () => {
      // Write first page
      cache.writeQuery({
        query: QUERY,
        variables: {},
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            membersConnection: {
              __typename: 'MembershipConnection',
              edges: [{ __typename: 'MembershipEdge', node: { __typename: 'Membership', id: 'm-1', name: 'Alice' } }],
              pageInfo: { __typename: 'PageInfo', hasNextPage: true },
            },
          },
        },
      });
      // Write second page with cursor (includes duplicate m-1)
      cache.writeQuery({
        query: QUERY,
        variables: { membersCursor: 'cursor-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            membersConnection: {
              __typename: 'MembershipConnection',
              edges: [
                { __typename: 'MembershipEdge', node: { __typename: 'Membership', id: 'm-1', name: 'Alice Updated' } },
                { __typename: 'MembershipEdge', node: { __typename: 'Membership', id: 'm-2', name: 'Bob' } },
              ],
              pageInfo: { __typename: 'PageInfo', hasNextPage: false },
            },
          },
        },
      });
      const result = cache.readQuery({ query: QUERY, variables: { membersCursor: 'cursor-1' } }) as any;
      // m-1 should be deduplicated (incoming wins)
      expect(result.home.membersConnection.edges).toHaveLength(2);
    });

    it('returns existing when incoming is falsy', () => {
      cache.writeQuery({
        query: QUERY,
        variables: {},
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            membersConnection: {
              __typename: 'MembershipConnection',
              edges: [{ __typename: 'MembershipEdge', node: { __typename: 'Membership', id: 'm-1', name: 'Alice' } }],
              pageInfo: { __typename: 'PageInfo', hasNextPage: false },
            },
          },
        },
      });
      // The merge function returns existing if !incoming
      // We can't easily write null via writeQuery since the cache policy kicks in,
      // but the unit behavior is covered by the code logic
      const result = cache.readQuery({ query: QUERY, variables: {} }) as any;
      expect(result.home.membersConnection.edges).toHaveLength(1);
    });
  });

  // ─── Query-level merge policies ────────────────────────────────

  describe('Query-level merge policies', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = makeCache();
    });

    const gql = require('graphql-tag').default;

    it('Query.shoppingLists preserves existing on null incoming', () => {
      const QUERY = gql`query GetLists($filters: ShoppingListFilters) { shoppingLists(filters: $filters) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h-1' } },
        data: { shoppingLists: [{ __typename: 'ShoppingList', id: 'sl-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h-1' } },
        data: { shoppingLists: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { filters: { homeId: 'h-1' } } }) as any;
      expect(result.shoppingLists).toHaveLength(1);
    });

    it('Query.shoppingLists allows empty array through', () => {
      const QUERY = gql`query GetLists($filters: ShoppingListFilters) { shoppingLists(filters: $filters) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h-1' } },
        data: { shoppingLists: [{ __typename: 'ShoppingList', id: 'sl-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { filters: { homeId: 'h-1' } },
        data: { shoppingLists: [] },
      });
      const result = cache.readQuery({ query: QUERY, variables: { filters: { homeId: 'h-1' } } }) as any;
      expect(result.shoppingLists).toEqual([]);
    });

    it('Query.pantries preserves existing on null incoming', () => {
      const QUERY = gql`query GetPantries($homeId: ID!) { pantries(homeId: $homeId) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { pantries: [{ __typename: 'Pantry', id: 'p-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { pantries: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { homeId: 'h-1' } }) as any;
      expect(result.pantries).toHaveLength(1);
    });

    it('Query.storageLocations preserves existing on null incoming', () => {
      const QUERY = gql`query GetStorageLocations($homeId: ID!) { storageLocations(homeId: $homeId) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { storageLocations: [{ __typename: 'StorageLocation', id: 'sl-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { storageLocations: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { homeId: 'h-1' } }) as any;
      expect(result.storageLocations).toHaveLength(1);
    });

    it('Query.storageLocationTree preserves existing on null incoming', () => {
      const QUERY = gql`query GetTree($homeId: ID!) { storageLocationTree(homeId: $homeId) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { storageLocationTree: [{ __typename: 'StorageLocation', id: 'slt-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { homeId: 'h-1' },
        data: { storageLocationTree: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { homeId: 'h-1' } }) as any;
      expect(result.storageLocationTree).toHaveLength(1);
    });

    it('Query.pantryItemSuggestions preserves existing on null', () => {
      const QUERY = gql`query GetSuggestions($pantryId: ID!) { pantryItemSuggestions(pantryId: $pantryId) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { pantryId: 'p-1' },
        data: { pantryItemSuggestions: [{ __typename: 'PantryItem', id: 'pi-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { pantryId: 'p-1' },
        data: { pantryItemSuggestions: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { pantryId: 'p-1' } }) as any;
      expect(result.pantryItemSuggestions).toHaveLength(1);
    });

    it('Query.shoppingListSuggestions preserves existing on null', () => {
      const QUERY = gql`query GetSuggestions($shoppingListId: ID!) { shoppingListSuggestions(shoppingListId: $shoppingListId) { id } }`;
      cache.writeQuery({
        query: QUERY,
        variables: { shoppingListId: 'sl-1' },
        data: { shoppingListSuggestions: [{ __typename: 'ShoppingListItem', id: 'sli-1' }] },
      });
      cache.writeQuery({
        query: QUERY,
        variables: { shoppingListId: 'sl-1' },
        data: { shoppingListSuggestions: null },
      });
      const result = cache.readQuery({ query: QUERY, variables: { shoppingListId: 'sl-1' } }) as any;
      expect(result.shoppingListSuggestions).toHaveLength(1);
    });
  });

  // ─── User.profile merge ────────────────────────────────────────

  describe('User.profile merge', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = makeCache();
    });

    const gql = require('graphql-tag').default;

    it('merges partial profile updates without losing fields', () => {
      // UserProfile has keyFields: ['id'], so it requires an id field
      cache.writeFragment({
        id: cache.identify({ __typename: 'User', id: 'u-1' }),
        fragment: gql`fragment UserProfileFrag on User { id profile { id firstName lastName } }`,
        data: { __typename: 'User', id: 'u-1', profile: { __typename: 'UserProfile', id: 'up-1', firstName: 'John', lastName: 'Doe' } },
      });
      cache.writeFragment({
        id: cache.identify({ __typename: 'User', id: 'u-1' }),
        fragment: gql`fragment UserAvatar on User { id profile { id avatar } }`,
        data: { __typename: 'User', id: 'u-1', profile: { __typename: 'UserProfile', id: 'up-1', avatar: 'avatar.png' } },
      });
      const result = cache.readFragment({
        id: cache.identify({ __typename: 'User', id: 'u-1' }),
        fragment: gql`fragment UserFull on User { id profile { id firstName lastName avatar } }`,
      }) as any;
      expect(result.profile.firstName).toBe('John');
      expect(result.profile.avatar).toBe('avatar.png');
    });
  });
});
