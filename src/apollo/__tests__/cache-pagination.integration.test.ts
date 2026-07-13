'use no memo';

jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {},
}));

import { gql } from '@apollo/client';
import { makeCache } from '../cache';

// ---------------------------------------------------------------------------
// Local result types for untyped (raw gql) cache reads
// ---------------------------------------------------------------------------

interface TestNode {
  id: string;
  [key: string]: unknown;
}
interface TestEdge {
  node: TestNode;
  [key: string]: unknown;
}
interface TestPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}
interface TestConnection {
  edges: TestEdge[];
  pageInfo: TestPageInfo;
  totalCount: number;
}
interface HomeShoppingListsResult {
  home?: { shoppingListsConnection?: TestConnection };
}
interface HomeMembersResult {
  home?: { membersConnection?: TestConnection };
}
interface ShoppingListItemsResult {
  shoppingList?: { itemsConnection?: TestConnection };
}
interface PantryItemsResult {
  pantry?: { itemsConnection?: TestConnection };
}
interface RecipesResult {
  recipes?: TestConnection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEdge(
  nodeTypeName: string,
  edgeTypeName: string,
  nodeFields: Record<string, unknown>,
) {
  return {
    __typename: edgeTypeName,
    node: { __typename: nodeTypeName, ...nodeFields },
  };
}

function buildConnection(
  connectionTypeName: string,
  edges: ReturnType<typeof buildEdge>[],
  pageInfo: { hasNextPage: boolean; endCursor: string | null },
  totalCount?: number,
) {
  return {
    __typename: connectionTypeName,
    edges,
    pageInfo: { __typename: 'PageInfo', ...pageInfo },
    totalCount: totalCount ?? edges.length,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cache pagination integration', () => {
  // =========================================================================
  // Section A: mergeConnectionByNodeId via Home.shoppingListsConnection
  //   cursorArg = 'after', keyArgs = ['filters']
  // =========================================================================

  describe('mergeConnectionByNodeId (Home.shoppingListsConnection, cursor=after)', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const slEdge = (id: string, name: string) =>
      buildEdge('ShoppingList', 'ShoppingListEdge', { id, name });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
      totalCount?: number,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1', ...vars },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              edges,
              pageInfo,
              totalCount,
            ),
          },
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      return result?.home?.shoppingListsConnection?.edges ?? [];
    };

    it('full lifecycle: page 1 → page 2 → refetch preserves all items', () => {
      const cache = makeCache();

      // Page 1 (3 items, hasNextPage:true)
      writeConn(
        cache,
        [slEdge('sl-1', 'A'), slEdge('sl-2', 'B'), slEdge('sl-3', 'C')],
        { hasNextPage: true, endCursor: 'c3' },
      );
      expect(readEdges(cache)).toHaveLength(3);

      // Page 2 (2 items with cursor)
      writeConn(
        cache,
        [slEdge('sl-4', 'D'), slEdge('sl-5', 'E')],
        { hasNextPage: false, endCursor: 'c5' },
        { after: 'c3' },
      );
      expect(readEdges(cache)).toHaveLength(5);

      // Refetch page 1 without cursor (hasNextPage:true) — must preserve page 2
      writeConn(
        cache,
        [slEdge('sl-1', 'A'), slEdge('sl-2', 'B'), slEdge('sl-3', 'C')],
        { hasNextPage: true, endCursor: 'c3' },
      );

      const edges = readEdges(cache);
      expect(edges).toHaveLength(5);
      const ids = edges.map(e => e.node.id);
      expect(ids).toEqual(
        expect.arrayContaining(['sl-1', 'sl-2', 'sl-3', 'sl-4', 'sl-5']),
      );
    });

    it('shrinkage: refetch with hasNextPage:false removes stale items', () => {
      const cache = makeCache();

      writeConn(cache, [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')], {
        hasNextPage: true,
        endCursor: 'c2',
      });
      writeConn(
        cache,
        [slEdge('sl-3', 'C')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );
      expect(readEdges(cache)).toHaveLength(3);

      // Refetch — all items fit in one page now (sl-2 was deleted server-side)
      writeConn(cache, [slEdge('sl-1', 'A'), slEdge('sl-3', 'C')], {
        hasNextPage: false,
        endCursor: 'c3',
      });

      const edges = readEdges(cache);
      expect(edges).toHaveLength(2);
      const ids = edges.map(e => e.node.id);
      expect(ids).toContain('sl-1');
      expect(ids).toContain('sl-3');
      expect(ids).not.toContain('sl-2');
    });

    it('updated items: refetch replaces page 1 items with updated data', () => {
      const cache = makeCache();

      writeConn(cache, [slEdge('sl-1', 'Old Name')], {
        hasNextPage: true,
        endCursor: 'c1',
      });
      writeConn(
        cache,
        [slEdge('sl-2', 'B')],
        { hasNextPage: false, endCursor: 'c2' },
        { after: 'c1' },
      );

      // Refetch with updated page 1 item
      writeConn(cache, [slEdge('sl-1', 'New Name')], {
        hasNextPage: true,
        endCursor: 'c1',
      });

      const edges = readEdges(cache);
      expect(edges).toHaveLength(2);
      // Incoming edges replace existing for same id in mergeConnectionByNodeId
      const sl1 = edges.find(e => e.node.id === 'sl-1');
      expect(sl1?.node.name).toBe('New Name');
      // Page 2 preserved
      expect(edges.find(e => e.node.id === 'sl-2')).toBeTruthy();
    });

    it('overlap deduplication: page 2 overlapping with page 1 produces no duplicates', () => {
      const cache = makeCache();

      writeConn(cache, [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')], {
        hasNextPage: true,
        endCursor: 'c2',
      });
      // Page 2 — sl-2 overlaps with page 1
      writeConn(
        cache,
        [slEdge('sl-2', 'B-updated'), slEdge('sl-3', 'C')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );

      const edges = readEdges(cache);
      expect(edges).toHaveLength(3);
      const ids = edges.map(e => e.node.id);
      expect(ids.filter((id: string) => id === 'sl-2')).toHaveLength(1);
    });
  });

  // =========================================================================
  // Section B: mergeConnectionByNodeId via Home.membersConnection
  //   cursorArg = 'after', keyArgs = ['filters']
  // =========================================================================

  describe('mergeConnectionByNodeId (Home.membersConnection, cursor=after)', () => {
    const QUERY = gql`
      query GetHome($id: ID!, $after: String) {
        home(id: $id) {
          id
          membersConnection(after: $after) {
            edges {
              node {
                id
                displayName
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      }
    `;

    const memberEdge = (id: string, displayName: string) =>
      buildEdge('Membership', 'MembershipEdge', { id, displayName });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1', ...vars },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            membersConnection: buildConnection(
              'MembershipConnection',
              edges,
              pageInfo,
            ),
          },
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<HomeMembersResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      return result?.home?.membersConnection?.edges ?? [];
    };

    it('full lifecycle with after arg', () => {
      const cache = makeCache();

      writeConn(cache, [memberEdge('m-1', 'Alice'), memberEdge('m-2', 'Bob')], {
        hasNextPage: true,
        endCursor: 'mc2',
      });
      writeConn(
        cache,
        [memberEdge('m-3', 'Charlie')],
        { hasNextPage: false, endCursor: 'mc3' },
        { after: 'mc2' },
      );
      expect(readEdges(cache)).toHaveLength(3);

      // Refetch without cursor (hasNextPage:true) — preserve page 2
      writeConn(cache, [memberEdge('m-1', 'Alice'), memberEdge('m-2', 'Bob')], {
        hasNextPage: true,
        endCursor: 'mc2',
      });

      const ids = readEdges(cache).map(e => e.node.id);
      expect(ids).toEqual(expect.arrayContaining(['m-1', 'm-2', 'm-3']));
    });

    it('shrinkage with after', () => {
      const cache = makeCache();

      writeConn(cache, [memberEdge('m-1', 'Alice')], {
        hasNextPage: true,
        endCursor: 'mc1',
      });
      writeConn(
        cache,
        [memberEdge('m-2', 'Bob')],
        { hasNextPage: false, endCursor: 'mc2' },
        { after: 'mc1' },
      );
      expect(readEdges(cache)).toHaveLength(2);

      // Refetch — member removed, all fit in one page
      writeConn(cache, [memberEdge('m-1', 'Alice')], {
        hasNextPage: false,
        endCursor: 'mc1',
      });

      expect(readEdges(cache)).toHaveLength(1);
      expect(readEdges(cache)[0].node.id).toBe('m-1');
    });
  });

  // =========================================================================
  // Section C: itemsConnectionFieldPolicy (ShoppingList.itemsConnection)
  //   Append-only merge, keyArgs = ['filters']
  // =========================================================================

  describe('itemsConnectionFieldPolicy (ShoppingList.itemsConnection)', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const QUERY_WITH_FILTER = gql`
      query GetList(
        $id: ID!
        $after: String
        $filters: ShoppingListItemFilters
      ) {
        shoppingList(id: $id) {
          id
          itemsConnection(after: $after, filters: $filters) {
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
            totalCount
          }
        }
      }
    `;

    const itemEdge = (id: string, name: string) =>
      buildEdge('ShoppingListItem', 'ShoppingListItemEdge', { id, name });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
      totalCount?: number,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'list-1', ...vars },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: buildConnection(
              'ShoppingListItemConnection',
              edges,
              pageInfo,
              totalCount,
            ),
          },
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY,
        variables: { id: 'list-1' },
      });
      return result?.shoppingList?.itemsConnection?.edges ?? [];
    };

    it('full lifecycle: append order preserved after pagination + refetch', () => {
      const cache = makeCache();

      // Page 1
      writeConn(cache, [itemEdge('si-1', 'Milk'), itemEdge('si-2', 'Bread')], {
        hasNextPage: true,
        endCursor: 'c2',
      });

      // Page 2
      writeConn(
        cache,
        [itemEdge('si-3', 'Eggs')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );

      let edges = readEdges(cache);
      expect(edges).toHaveLength(3);
      // Append-only: page 1 edges come first, then page 2
      expect(edges.map(e => e.node.id)).toEqual(['si-1', 'si-2', 'si-3']);

      // Refetch page 1 (no cursor, hasNextPage:true) — must preserve page 2
      writeConn(cache, [itemEdge('si-1', 'Milk'), itemEdge('si-2', 'Bread')], {
        hasNextPage: true,
        endCursor: 'c2',
      });

      edges = readEdges(cache);
      expect(edges).toHaveLength(3);
      expect(edges.map(e => e.node.id)).toEqual(['si-1', 'si-2', 'si-3']);
    });

    it('overlap deduplication: existing position kept', () => {
      const cache = makeCache();

      writeConn(cache, [itemEdge('si-1', 'Milk'), itemEdge('si-2', 'Bread')], {
        hasNextPage: true,
        endCursor: 'c2',
      });
      // Page 2 — si-2 overlaps with page 1
      writeConn(
        cache,
        [itemEdge('si-2', 'Bread-updated'), itemEdge('si-3', 'Eggs')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );

      const edges = readEdges(cache);
      // Append-only: si-2 already exists at position 1, not appended again
      expect(edges).toHaveLength(3);
      const ids = edges.map(e => e.node.id);
      expect(ids.filter((id: string) => id === 'si-2')).toHaveLength(1);
      // Existing position preserved (si-2 stays at index 1)
      expect(ids[1]).toBe('si-2');
    });

    it('shrinkage: hasNextPage:false replaces all', () => {
      const cache = makeCache();

      writeConn(cache, [itemEdge('si-1', 'Milk')], {
        hasNextPage: true,
        endCursor: 'c1',
      });
      writeConn(
        cache,
        [itemEdge('si-2', 'Bread')],
        { hasNextPage: false, endCursor: 'c2' },
        { after: 'c1' },
      );
      expect(readEdges(cache)).toHaveLength(2);

      // Refetch — items removed, all fit in one page
      writeConn(cache, [itemEdge('si-1', 'Milk')], {
        hasNextPage: false,
        endCursor: 'c1',
      });

      expect(readEdges(cache)).toHaveLength(1);
      expect(readEdges(cache)[0].node.id).toBe('si-1');
    });

    it('filter separation: different filters create independent cache entries', () => {
      const cache = makeCache();

      // Write to default (no filter) entry
      writeConn(cache, [itemEdge('si-1', 'Milk')], {
        hasNextPage: false,
        endCursor: 'c1',
      });

      // Write to filtered entry
      cache.writeQuery({
        query: QUERY_WITH_FILTER,
        variables: { id: 'list-1', filters: { purchased: true } },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: buildConnection(
              'ShoppingListItemConnection',
              [itemEdge('si-2', 'Bread')],
              { hasNextPage: false, endCursor: 'c1' },
            ),
          },
        },
      });

      // Read default — should only have si-1
      const defaultEdges = readEdges(cache);
      expect(defaultEdges).toHaveLength(1);
      expect(defaultEdges[0].node.id).toBe('si-1');

      // Read filtered — should only have si-2
      const filteredResult = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY_WITH_FILTER,
        variables: { id: 'list-1', filters: { purchased: true } },
      });
      const filteredEdges =
        filteredResult?.shoppingList?.itemsConnection?.edges ?? [];
      expect(filteredEdges).toHaveLength(1);
      expect(filteredEdges[0].node.id).toBe('si-2');
    });

    it('cursor-based fetchMore with all-duplicate edges preserves existing pageInfo', () => {
      const cache = makeCache();

      // Page 1
      writeConn(cache, [itemEdge('si-1', 'Milk'), itemEdge('si-2', 'Bread')], {
        hasNextPage: true,
        endCursor: 'c2',
      });

      // Page 2 (final page)
      writeConn(
        cache,
        [itemEdge('si-3', 'Eggs')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );

      // Verify final state: 3 edges, hasNextPage=false
      let result = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY,
        variables: { id: 'list-1' },
      });
      expect(result?.shoppingList?.itemsConnection?.edges).toHaveLength(3);
      expect(result?.shoppingList?.itemsConnection?.pageInfo.hasNextPage).toBe(
        false,
      );
      expect(result?.shoppingList?.itemsConnection?.pageInfo.endCursor).toBe(
        'c3',
      );

      // Duplicate cursor request: same cursor c2 sent again due to race condition.
      // Server returns items after c2 with hasNextPage=true (correct from c2's perspective).
      // All edges are duplicates — must NOT overwrite hasNextPage=false with true.
      writeConn(
        cache,
        [itemEdge('si-3', 'Eggs')],
        { hasNextPage: true, endCursor: 'c3' },
        { after: 'c2' },
      );

      result = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY,
        variables: { id: 'list-1' },
      });
      expect(result?.shoppingList?.itemsConnection?.edges).toHaveLength(3);
      // Existing pageInfo preserved — hasNextPage stays false
      expect(result?.shoppingList?.itemsConnection?.pageInfo.hasNextPage).toBe(
        false,
      );
      expect(result?.shoppingList?.itemsConnection?.pageInfo.endCursor).toBe(
        'c3',
      );
    });
  });

  // =========================================================================
  // Section C.2: itemsConnectionFieldPolicy — bounded edge window
  //   Verifies MAX_WINDOW_EDGES eviction behavior
  // =========================================================================

  describe('itemsConnectionFieldPolicy bounded edge window', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const itemEdge = (id: string, name: string) =>
      buildEdge('ShoppingListItem', 'ShoppingListItemEdge', { id, name });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
      totalCount?: number,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'list-1', ...vars },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            itemsConnection: buildConnection(
              'ShoppingListItemConnection',
              edges,
              pageInfo,
              totalCount,
            ),
          },
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY,
        variables: { id: 'list-1' },
      });
      return result?.shoppingList?.itemsConnection?.edges ?? [];
    };

    it('initial load within window limit retains all edges', () => {
      const cache = makeCache();

      const edges = Array.from({ length: 50 }, (_, i) =>
        itemEdge(`si-${i}`, `Item ${i}`),
      );
      writeConn(
        cache,
        edges,
        { hasNextPage: true, endCursor: 'c50' },
        undefined,
        200,
      );

      expect(readEdges(cache)).toHaveLength(50);
    });

    it('evicts oldest edges when exceeding window limit', () => {
      const cache = makeCache();

      // Write 80 edges as page 1
      const page1 = Array.from({ length: 80 }, (_, i) =>
        itemEdge(`si-${i}`, `Item ${i}`),
      );
      writeConn(
        cache,
        page1,
        { hasNextPage: true, endCursor: 'c80' },
        undefined,
        300,
      );

      // Write 40 more edges as page 2 (total would be 120, exceeding 100)
      const page2 = Array.from({ length: 40 }, (_, i) =>
        itemEdge(`si-${80 + i}`, `Item ${80 + i}`),
      );
      writeConn(
        cache,
        page2,
        { hasNextPage: true, endCursor: 'c120' },
        { after: 'c80' },
        300,
      );

      const edges = readEdges(cache);
      // Should be capped at 100 (MAX_WINDOW_EDGES)
      expect(edges).toHaveLength(100);
      // Oldest 20 edges (si-0 through si-19) should be evicted
      const ids = edges.map(e => e.node.id);
      expect(ids).not.toContain('si-0');
      expect(ids).not.toContain('si-19');
      expect(ids).toContain('si-20');
      expect(ids).toContain('si-119');
    });

    it('background refetch within window limit does not evict', () => {
      const cache = makeCache();

      // Write 100 edges
      const page1 = Array.from({ length: 100 }, (_, i) =>
        itemEdge(`si-${i}`, `Item ${i}`),
      );
      writeConn(
        cache,
        page1,
        { hasNextPage: true, endCursor: 'c100' },
        undefined,
        200,
      );

      // Background refetch returns first 50 (no cursor, hasNextPage:true)
      const refetch = Array.from({ length: 50 }, (_, i) =>
        itemEdge(`si-${i}`, `Item ${i}`),
      );
      writeConn(
        cache,
        refetch,
        { hasNextPage: true, endCursor: 'c50' },
        undefined,
        200,
      );

      // All 100 should still be there (deduped, within limit)
      expect(readEdges(cache)).toHaveLength(100);
    });
  });

  // =========================================================================
  // Section D: Pantry.itemsConnection (shared policy)
  //   keyArgs = ['filters', 'orderBy']
  // =========================================================================

  describe('Pantry.itemsConnection', () => {
    const QUERY = gql`
      query GetPantry($id: ID!, $after: String) {
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
            totalCount
          }
        }
      }
    `;

    const QUERY_WITH_ORDER = gql`
      query GetPantry($id: ID!, $after: String, $orderBy: PantryItemOrderBy) {
        pantry(id: $id) {
          id
          itemsConnection(after: $after, orderBy: $orderBy) {
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
            totalCount
          }
        }
      }
    `;

    const piEdge = (id: string, name: string) =>
      buildEdge('PantryItem', 'PantryItemEdge', { id, name });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'p-1', ...vars },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p-1',
            itemsConnection: buildConnection(
              'PantryItemConnection',
              edges,
              pageInfo,
            ),
          },
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<PantryItemsResult>({
        query: QUERY,
        variables: { id: 'p-1' },
      });
      return result?.pantry?.itemsConnection?.edges ?? [];
    };

    it('full lifecycle: pagination + refetch preservation', () => {
      const cache = makeCache();

      writeConn(cache, [piEdge('pi-1', 'Flour'), piEdge('pi-2', 'Sugar')], {
        hasNextPage: true,
        endCursor: 'c2',
      });
      writeConn(
        cache,
        [piEdge('pi-3', 'Salt')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
      );
      expect(readEdges(cache)).toHaveLength(3);

      // Refetch page 1 (no cursor, hasNextPage:true)
      writeConn(cache, [piEdge('pi-1', 'Flour'), piEdge('pi-2', 'Sugar')], {
        hasNextPage: true,
        endCursor: 'c2',
      });

      const ids = readEdges(cache).map(e => e.node.id);
      expect(ids).toEqual(expect.arrayContaining(['pi-1', 'pi-2', 'pi-3']));
    });

    it('shrinkage: hasNextPage:false clears stale items', () => {
      const cache = makeCache();

      writeConn(cache, [piEdge('pi-1', 'Flour')], {
        hasNextPage: true,
        endCursor: 'c1',
      });
      writeConn(
        cache,
        [piEdge('pi-2', 'Sugar')],
        { hasNextPage: false, endCursor: 'c2' },
        { after: 'c1' },
      );
      expect(readEdges(cache)).toHaveLength(2);

      // Refetch — all fit in one page
      writeConn(cache, [piEdge('pi-1', 'Flour')], {
        hasNextPage: false,
        endCursor: 'c1',
      });

      expect(readEdges(cache)).toHaveLength(1);
      expect(readEdges(cache)[0].node.id).toBe('pi-1');
    });

    it('orderBy separation: different orderBy create separate cache entries', () => {
      const cache = makeCache();

      // Write with orderBy: NAME_ASC
      cache.writeQuery({
        query: QUERY_WITH_ORDER,
        variables: { id: 'p-1', orderBy: 'NAME_ASC' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p-1',
            itemsConnection: buildConnection(
              'PantryItemConnection',
              [piEdge('pi-1', 'Apple'), piEdge('pi-2', 'Banana')],
              { hasNextPage: false, endCursor: 'c2' },
            ),
          },
        },
      });

      // Write with orderBy: NAME_DESC
      cache.writeQuery({
        query: QUERY_WITH_ORDER,
        variables: { id: 'p-1', orderBy: 'NAME_DESC' },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p-1',
            itemsConnection: buildConnection(
              'PantryItemConnection',
              [piEdge('pi-2', 'Banana'), piEdge('pi-1', 'Apple')],
              { hasNextPage: false, endCursor: 'c2' },
            ),
          },
        },
      });

      // Read NAME_ASC — order should be [Apple, Banana]
      const ascResult = cache.readQuery<PantryItemsResult>({
        query: QUERY_WITH_ORDER,
        variables: { id: 'p-1', orderBy: 'NAME_ASC' },
      });
      const ascIds = ascResult?.pantry?.itemsConnection?.edges?.map(
        e => e.node.id,
      );
      expect(ascIds).toEqual(['pi-1', 'pi-2']);

      // Read NAME_DESC — order should be [Banana, Apple]
      const descResult = cache.readQuery<PantryItemsResult>({
        query: QUERY_WITH_ORDER,
        variables: { id: 'p-1', orderBy: 'NAME_DESC' },
      });
      const descIds = descResult?.pantry?.itemsConnection?.edges?.map(
        e => e.node.id,
      );
      expect(descIds).toEqual(['pi-2', 'pi-1']);
    });
  });

  // =========================================================================
  // Section E: Query.recipes via mergeConnectionByNodeId()
  //   keyArgs = ['filters'], cursor arg = 'after'
  // =========================================================================

  describe('Query.recipes (after arg)', () => {
    const QUERY = gql`
      query GetRecipes($after: String, $filters: RecipeFilters) {
        recipes(after: $after, filters: $filters) {
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
          totalCount
        }
      }
    `;

    const recipeEdge = (id: string, name: string) =>
      buildEdge('Recipe', 'RecipeEdge', { id, name });

    const writeRecipes = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: vars ?? {},
        data: {
          recipes: buildConnection('RecipeConnection', edges, pageInfo),
        },
      });
    };

    const readEdges = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<RecipesResult>({
        query: QUERY,
        variables: {},
      });
      return result?.recipes?.edges ?? [];
    };

    it('full lifecycle with after arg', () => {
      const cache = makeCache();

      writeRecipes(
        cache,
        [recipeEdge('r-1', 'Pasta'), recipeEdge('r-2', 'Salad')],
        { hasNextPage: true, endCursor: 'rc2' },
      );
      writeRecipes(
        cache,
        [recipeEdge('r-3', 'Soup')],
        { hasNextPage: false, endCursor: 'rc3' },
        { after: 'rc2' },
      );
      expect(readEdges(cache)).toHaveLength(3);

      // Refetch (no cursor, hasNextPage:true)
      writeRecipes(
        cache,
        [recipeEdge('r-1', 'Pasta'), recipeEdge('r-2', 'Salad')],
        { hasNextPage: true, endCursor: 'rc2' },
      );

      const ids = readEdges(cache).map(e => e.node.id);
      expect(ids).toEqual(expect.arrayContaining(['r-1', 'r-2', 'r-3']));
    });

    it('shrinkage', () => {
      const cache = makeCache();

      writeRecipes(cache, [recipeEdge('r-1', 'Pasta')], {
        hasNextPage: true,
        endCursor: 'rc1',
      });
      writeRecipes(
        cache,
        [recipeEdge('r-2', 'Salad')],
        { hasNextPage: false, endCursor: 'rc2' },
        { after: 'rc1' },
      );
      expect(readEdges(cache)).toHaveLength(2);

      // Refetch — only 1 recipe now
      writeRecipes(cache, [recipeEdge('r-1', 'Pasta')], {
        hasNextPage: false,
        endCursor: 'rc1',
      });

      expect(readEdges(cache)).toHaveLength(1);
      expect(readEdges(cache)[0].node.id).toBe('r-1');
    });

    it('keeps different filter sets in distinct cache entries', () => {
      const cache = makeCache();

      // Unfiltered list
      writeRecipes(
        cache,
        [recipeEdge('r-1', 'Pasta'), recipeEdge('r-2', 'Salad')],
        { hasNextPage: false, endCursor: 'rc2' },
      );
      // Filtered list — must not touch the unfiltered entry
      writeRecipes(
        cache,
        [recipeEdge('r-9', 'Tiramisu')],
        { hasNextPage: false, endCursor: 'rc9' },
        { filters: { category: 'DESSERT' } },
      );

      const unfiltered = readEdges(cache).map(e => e.node.id);
      expect(unfiltered).toEqual(['r-1', 'r-2']);

      const filtered = cache.readQuery<RecipesResult>({
        query: QUERY,
        variables: { filters: { category: 'DESSERT' } },
      });
      expect(filtered?.recipes?.edges.map(e => e.node.id)).toEqual(['r-9']);
    });

    it('variable-less writes and reads resolve the same entry (writer symmetry)', () => {
      const cache = makeCache();

      writeRecipes(cache, [recipeEdge('r-1', 'Pasta')], {
        hasNextPage: false,
        endCursor: 'rc1',
      });

      // cache.updateQuery({ query }) with no variables — the
      // recipeCacheWriters pattern — must land on the entry the
      // variable-less read resolves.
      cache.updateQuery<RecipesResult>({ query: QUERY }, data =>
        data?.recipes
          ? {
              recipes: {
                ...data.recipes,
                edges: [
                  ...data.recipes.edges,
                  {
                    __typename: 'RecipeEdge',
                    node: { __typename: 'Recipe', id: 'r-2', name: 'Salad' },
                  },
                ],
              },
            }
          : data,
      );

      expect(readEdges(cache).map(e => e.node.id)).toEqual(['r-1', 'r-2']);
    });
  });

  // =========================================================================
  // Section F: totalCount consistency
  // =========================================================================

  describe('totalCount consistency', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const slEdge = (id: string, name: string) =>
      buildEdge('ShoppingList', 'ShoppingListEdge', { id, name });

    it('totalCount reflects server value at each pagination stage', () => {
      const cache = makeCache();

      // Page 1: server says totalCount=5
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')],
              { hasNextPage: true, endCursor: 'c2' },
              5,
            ),
          },
        },
      });

      let result = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      expect(result?.home?.shoppingListsConnection?.totalCount).toBe(5);

      // Page 2: server says totalCount=5 still
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1', after: 'c2' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-3', 'C')],
              { hasNextPage: false, endCursor: 'c3' },
              5,
            ),
          },
        },
      });

      result = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      // After merge, totalCount comes from ...incoming spread
      expect(result?.home?.shoppingListsConnection?.totalCount).toBe(5);

      // Refetch: totalCount changed to 3 (items were deleted)
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')],
              { hasNextPage: true, endCursor: 'c2' },
              3,
            ),
          },
        },
      });

      result = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      expect(result?.home?.shoppingListsConnection?.totalCount).toBe(3);
    });
  });

  // =========================================================================
  // Section G: pageInfo preservation on background refetch
  //
  // Verifies that when cache has accumulated pages 1+2 (hasNextPage:false),
  // a background refetch returning page 1 only (hasNextPage:true) does NOT
  // overwrite the accumulated pageInfo.
  // =========================================================================

  describe('pageInfo preservation on background refetch', () => {
    const QUERY = gql`
      query GetPantry($id: ID!, $after: String) {
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
            totalCount
          }
        }
      }
    `;

    const piEdge = (id: string, name: string) =>
      buildEdge('PantryItem', 'PantryItemEdge', { id, name });

    const writeConn = (
      cache: ReturnType<typeof makeCache>,
      edges: ReturnType<typeof buildEdge>[],
      pageInfo: { hasNextPage: boolean; endCursor: string | null },
      vars?: Record<string, unknown>,
      totalCount?: number,
    ) => {
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'p-1', ...vars },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p-1',
            itemsConnection: buildConnection(
              'PantryItemConnection',
              edges,
              pageInfo,
              totalCount,
            ),
          },
        },
      });
    };

    const readConnection = (cache: ReturnType<typeof makeCache>) => {
      const result = cache.readQuery<PantryItemsResult>({
        query: QUERY,
        variables: { id: 'p-1' },
      });
      return result?.pantry?.itemsConnection;
    };

    it('preserves hasNextPage:false after background refetch returns hasNextPage:true', () => {
      const cache = makeCache();

      // Page 1 (3 items, hasNextPage:true)
      writeConn(
        cache,
        [piEdge('pi-1', 'A'), piEdge('pi-2', 'B'), piEdge('pi-3', 'C')],
        { hasNextPage: true, endCursor: 'c3' },
        undefined,
        5,
      );

      // Page 2 (2 items, hasNextPage:false — all loaded)
      writeConn(
        cache,
        [piEdge('pi-4', 'D'), piEdge('pi-5', 'E')],
        { hasNextPage: false, endCursor: 'c5' },
        { after: 'c3' },
        5,
      );

      let conn = readConnection(cache);
      expect(conn?.edges).toHaveLength(5);
      expect(conn?.pageInfo.hasNextPage).toBe(false);
      expect(conn?.pageInfo.endCursor).toBe('c5');

      // Background refetch: page 1 only (hasNextPage:true)
      // This simulates cache-and-network re-fetching the initial query
      writeConn(
        cache,
        [piEdge('pi-1', 'A'), piEdge('pi-2', 'B'), piEdge('pi-3', 'C')],
        { hasNextPage: true, endCursor: 'c3' },
        undefined,
        5,
      );

      conn = readConnection(cache);
      // Edges must be preserved
      expect(conn?.edges).toHaveLength(5);
      // pageInfo must NOT be overwritten — hasNextPage should remain false
      expect(conn?.pageInfo.hasNextPage).toBe(false);
      expect(conn?.pageInfo.endCursor).toBe('c5');
    });

    it('does NOT preserve pageInfo when refetch has hasNextPage:false (shrinkage)', () => {
      const cache = makeCache();

      writeConn(
        cache,
        [piEdge('pi-1', 'A'), piEdge('pi-2', 'B')],
        { hasNextPage: true, endCursor: 'c2' },
        undefined,
        3,
      );
      writeConn(
        cache,
        [piEdge('pi-3', 'C')],
        { hasNextPage: false, endCursor: 'c3' },
        { after: 'c2' },
        3,
      );

      // Refetch with fewer items and hasNextPage:false — replaces entirely
      writeConn(
        cache,
        [piEdge('pi-1', 'A')],
        { hasNextPage: false, endCursor: 'c1' },
        undefined,
        1,
      );

      const conn = readConnection(cache);
      expect(conn?.edges).toHaveLength(1);
      expect(conn?.pageInfo.hasNextPage).toBe(false);
      expect(conn?.pageInfo.endCursor).toBe('c1');
    });
  });

  // =========================================================================
  // Section H: Stable reference on no-change merge
  //
  // Verifies that when edges, pageInfo, and totalCount are all unchanged,
  // the merge returns the exact same object reference to prevent re-renders.
  // =========================================================================

  describe('stable reference on no-change merge', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const slEdge = (id: string, name: string) =>
      buildEdge('ShoppingList', 'ShoppingListEdge', { id, name });

    it('returns same reference when refetch has identical data', () => {
      const cache = makeCache();

      // Initial write
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')],
              { hasNextPage: true, endCursor: 'c2' },
              5,
            ),
          },
        },
      });

      const result1 = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      const conn1 = result1?.home?.shoppingListsConnection;

      // Refetch with same edges, same pageInfo, same totalCount
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A'), slEdge('sl-2', 'B')],
              { hasNextPage: true, endCursor: 'c2' },
              5,
            ),
          },
        },
      });

      const result2 = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      const conn2 = result2?.home?.shoppingListsConnection;

      // Should be the exact same object reference (stable)
      expect(conn2).toBe(conn1);
    });

    it('returns new reference when totalCount changes', () => {
      const cache = makeCache();

      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A')],
              { hasNextPage: true, endCursor: 'c1' },
              3,
            ),
          },
        },
      });

      const result1 = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      const conn1 = result1?.home?.shoppingListsConnection;

      // Refetch with same edges but different totalCount
      cache.writeQuery({
        query: QUERY,
        variables: { id: 'home-1' },
        data: {
          home: {
            __typename: 'Home',
            id: 'home-1',
            shoppingListsConnection: buildConnection(
              'ShoppingListConnection',
              [slEdge('sl-1', 'A')],
              { hasNextPage: true, endCursor: 'c1' },
              5,
            ),
          },
        },
      });

      const result2 = cache.readQuery<HomeShoppingListsResult>({
        query: QUERY,
        variables: { id: 'home-1' },
      });
      const conn2 = result2?.home?.shoppingListsConnection;

      // Should be a new reference since totalCount changed
      expect(conn2).not.toBe(conn1);
      expect(conn2?.totalCount).toBe(5);
    });
  });

  // =========================================================================
  // Section I: ApolloClient-level integration with MockLink
  //
  // Proves merge functions work through the full Apollo Client pipeline
  // (variable normalization, field policy matching, fetchMore).
  // =========================================================================

  describe('ApolloClient-level integration with MockLink', () => {
    const QUERY = gql`
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
            totalCount
          }
        }
      }
    `;

    const itemEdge = (id: string, name: string) =>
      buildEdge('ShoppingListItem', 'ShoppingListItemEdge', { id, name });

    it('query + fetchMore accumulates pages through merge functions', async () => {
      const { ApolloClient } = require('@apollo/client');
      const { MockLink } = require('@apollo/client/testing');

      const cache = makeCache();

      const page1Data = {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          itemsConnection: buildConnection(
            'ShoppingListItemConnection',
            [itemEdge('si-1', 'Milk')],
            { hasNextPage: true, endCursor: 'c1' },
            2,
          ),
        },
      };

      const page2Data = {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          itemsConnection: buildConnection(
            'ShoppingListItemConnection',
            [itemEdge('si-2', 'Bread')],
            { hasNextPage: false, endCursor: 'c2' },
            2,
          ),
        },
      };

      const mocks = [
        {
          request: { query: QUERY, variables: { id: 'list-1' } },
          result: { data: page1Data },
        },
        {
          request: { query: QUERY, variables: { id: 'list-1', after: 'c1' } },
          result: { data: page2Data },
        },
      ];

      const client = new ApolloClient({
        cache,
        link: new MockLink(mocks, { addTypename: false }),
      });

      // Initial query
      const { data: page1 } = await client.query({
        query: QUERY,
        variables: { id: 'list-1' },
      });

      expect(page1.shoppingList.itemsConnection.edges).toHaveLength(1);
      expect(page1.shoppingList.itemsConnection.edges[0].node.id).toBe('si-1');

      // fetchMore for page 2
      const observable = client.watchQuery({
        query: QUERY,
        variables: { id: 'list-1' },
      });

      await observable.fetchMore({ variables: { after: 'c1' } });

      // Read accumulated result from cache
      const result = cache.readQuery<ShoppingListItemsResult>({
        query: QUERY,
        variables: { id: 'list-1' },
      });

      const edges = result?.shoppingList?.itemsConnection?.edges ?? [];
      expect(edges).toHaveLength(2);

      const ids = edges.map(e => e.node.id);
      expect(ids).toContain('si-1');
      expect(ids).toContain('si-2');
    });
  });
});
