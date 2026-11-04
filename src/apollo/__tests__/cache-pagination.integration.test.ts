'use no memo';

jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {},
}));

import { ApolloClient, gql, type DocumentNode } from '@apollo/client';
import { makeCache } from '../cache';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';
import { seedQuery, testMockLink } from '#/test-utils/apolloMockProvider';

type Cache = ReturnType<typeof makeCache>;
type Vars = Record<string, unknown>;
interface Node {
  id: string;
  [field: string]: unknown;
}
interface Entity {
  __typename: string;
  id: string;
}
interface Connection {
  edges: { node: Node }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}
interface Page {
  /** The `fetchMore` cursor; without one the write is a cursorless (re)fetch. */
  after?: string;
  hasNextPage?: boolean;
  totalCount?: number;
  variables?: Vars;
}

const HOME: Entity = { __typename: 'Home', id: 'home-1' };
const LIST: Entity = { __typename: 'ShoppingList', id: 'list-1' };

/** A `<type>Connection` page whose end cursor is `after-<its last id>`. */
function connection(
  type: string,
  nodes: (string | Node)[],
  { hasNextPage = false, totalCount = nodes.length }: Page = {},
) {
  const rows = nodes.map(node =>
    typeof node === 'string' ? { id: node } : node,
  );
  return {
    __typename: `${type}Connection`,
    edges: rows.map(node => ({
      __typename: `${type}Edge`,
      node: { __typename: type, ...node },
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage,
      endCursor: `after-${rows.at(-1)?.id ?? ''}`,
    },
    totalCount,
  };
}

interface ConnectionSpec {
  query: DocumentNode;
  variables: Vars;
  /** The root field the connection hangs off, and the entity it answers. */
  parent?: [root: string, entity: Entity];
  field: string;
  /** The node typename; edge and connection typenames derive from it. */
  type: string;
}

/** Binds `spec`'s connection to a cache: writes pages and reads them back. */
const connectionOn =
  (spec: ConnectionSpec) =>
  (cache: Cache = makeCache()) => {
    const answer = (nodes: (string | Node)[], page: Page = {}) => {
      const conn = connection(spec.type, nodes, page);
      if (!spec.parent) return { [spec.field]: conn };
      const [root, entity] = spec.parent;
      return { [root]: { ...entity, [spec.field]: conn } };
    };
    const read = (variables?: Vars) => {
      const options = {
        query: spec.query,
        variables: { ...spec.variables, ...variables },
      };
      if (!spec.parent) {
        return cache.readQuery<Record<string, Connection | undefined>>(
          options,
        )?.[spec.field];
      }
      return cache.readQuery<
        Record<string, Record<string, Connection | undefined> | undefined>
      >(options)?.[spec.parent[0]]?.[spec.field];
    };
    /** What a reader sees: the rows, and where `fetchMore` resumes. */
    const state = (variables?: Vars) => {
      const conn = read(variables);
      return (
        conn && {
          ids: conn.edges.map(edge => edge.node.id),
          hasNextPage: conn.pageInfo.hasNextPage,
          endCursor: conn.pageInfo.endCursor,
        }
      );
    };
    return {
      cache,
      answer,
      read,
      state,
      ids: (variables?: Vars) => state(variables)?.ids,
      write: (nodes: (string | Node)[], page: Page = {}) =>
        seedQuery(cache, {
          query: spec.query,
          variables: {
            ...spec.variables,
            ...page.variables,
            after: page.after,
          },
          data: answer(nodes, page),
        }),
    };
  };

const HOME_LISTS = gql`
  query HomeLists($id: ID!, $after: String) {
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

const HOME_MEMBERS = gql`
  query HomeMembers($id: ID!, $after: String) {
    home(id: $id) {
      id
      membersConnection(after: $after) {
        edges {
          node {
            id
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

const LIST_ITEMS = gql`
  query ListItems($id: ID!, $after: String, $filters: ShoppingListItemFilters) {
    shoppingList(id: $id) {
      id
      itemsConnection(after: $after, filters: $filters) {
        edges {
          node {
            id
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

const PANTRY_ITEMS = gql`
  query PantryItems($id: ID!, $after: String, $orderBy: PantryItemOrderBy) {
    pantry(id: $id) {
      id
      itemsConnection(after: $after, orderBy: $orderBy) {
        edges {
          node {
            id
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

const RECIPES = gql`
  query Recipes($after: String, $filters: RecipeFilters) {
    recipes(after: $after, filters: $filters) {
      edges {
        node {
          id
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

const USAGE_RECORDS = gql`
  query UsageRecords($id: ID!, $first: Int, $after: String) {
    pantryItem(id: $id) {
      id
      usageRecordsConnection(
        first: $first
        after: $after
        orderBy: { usedAt: DESC }
      ) {
        edges {
          node {
            id
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

// The detail screen reads a 100-edge window with no cursor; the history screen
// pages. Both key to pantryItemBatchesConnection({pantryItemId}), so each write
// has to leave the field able to satisfy the other's read.
const BATCH_DETAIL = gql`
  query BatchDetail($pantryItemId: ID!) {
    pantryItemBatchesConnection(pantryItemId: $pantryItemId, first: 100) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
        }
      }
    }
  }
`;

const BATCH_HISTORY = gql`
  query BatchHistory($pantryItemId: ID!, $first: Int, $after: String) {
    pantryItemBatchesConnection(
      pantryItemId: $pantryItemId
      first: $first
      after: $after
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
        }
      }
    }
  }
`;

const LIST_ROWS_SELECTING_LIST = gql`
  query ListRows($after: String) {
    shoppingList(id: "list-1") {
      id
      itemsConnection(first: 2, after: $after) {
        totalCount
        edges {
          cursor
          node {
            id
            shoppingList {
              id
            }
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

const HOME_ROWS_SELECTING_HOME = gql`
  query HomeRows($after: String) {
    home(id: "home-1") {
      id
      membersConnection(first: 2, after: $after) {
        totalCount
        edges {
          cursor
          node {
            id
            home {
              id
            }
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

const homeLists = connectionOn({
  query: HOME_LISTS,
  variables: { id: HOME.id },
  parent: ['home', HOME],
  field: 'shoppingListsConnection',
  type: 'ShoppingList',
});
const homeMembers = connectionOn({
  query: HOME_MEMBERS,
  variables: { id: HOME.id },
  parent: ['home', HOME],
  field: 'membersConnection',
  type: 'Membership',
});
const listItems = connectionOn({
  query: LIST_ITEMS,
  variables: { id: LIST.id },
  parent: ['shoppingList', LIST],
  field: 'itemsConnection',
  type: 'ShoppingListItem',
});
const pantryItems = connectionOn({
  query: PANTRY_ITEMS,
  variables: { id: 'p-1' },
  parent: ['pantry', { __typename: 'Pantry', id: 'p-1' }],
  field: 'itemsConnection',
  type: 'PantryItem',
});
const recipes = connectionOn({
  query: RECIPES,
  variables: {},
  field: 'recipes',
  type: 'Recipe',
});
const usageRecords = connectionOn({
  query: USAGE_RECORDS,
  variables: { id: 'pi-1', first: 30 },
  parent: ['pantryItem', { __typename: 'PantryItem', id: 'pi-1' }],
  field: 'usageRecordsConnection',
  type: 'PantryItemUsage',
});
const batchDetail = connectionOn({
  query: BATCH_DETAIL,
  variables: { pantryItemId: 'pi-1' },
  field: 'pantryItemBatchesConnection',
  type: 'PantryItemBatch',
});
const batchHistory = connectionOn({
  query: BATCH_HISTORY,
  variables: { pantryItemId: 'pi-1', first: 30 },
  field: 'pantryItemBatchesConnection',
  type: 'PantryItemBatch',
});
const listRows = connectionOn({
  query: LIST_ROWS_SELECTING_LIST,
  variables: {},
  parent: ['shoppingList', LIST],
  field: 'itemsConnection',
  type: 'ShoppingListItem',
});
const homeRows = connectionOn({
  query: HOME_ROWS_SELECTING_HOME,
  variables: {},
  parent: ['home', HOME],
  field: 'membersConnection',
  type: 'Membership',
});

/** Page `[a, b]`, then the last page `[c]`: every row held. */
const ABC_LOADED = {
  ids: ['a', 'b', 'c'],
  hasNextPage: false,
  endCursor: 'after-c',
};

describe('cache pagination integration', () => {
  describe.each([
    ['Home.shoppingListsConnection (mergeConnectionByNodeId)', homeLists],
    ['Home.membersConnection (mergeConnectionByNodeId)', homeMembers],
    ['Query.recipes (mergeConnectionByNodeId)', recipes],
    [
      'PantryItem.usageRecordsConnection (mergeConnectionByNodeId)',
      usageRecords,
    ],
    ['ShoppingList.itemsConnection (itemsConnectionFieldPolicy)', listItems],
    ['Pantry.itemsConnection (itemsConnectionFieldPolicy)', pantryItems],
  ])('%s', (_name, open) => {
    it('appends a fetchMore page and keeps it, and its cursor, through a cursorless refetch of page one', () => {
      const conn = open();
      conn.write(['a', 'b'], { hasNextPage: true });
      conn.write(['c'], { after: 'after-b' });
      expect(conn.state()).toEqual(ABC_LOADED);

      conn.write(['a', 'b'], { hasNextPage: true });
      expect(conn.state()).toEqual(ABC_LOADED);
    });

    it('keeps one copy of a row a fetchMore page restates, in its first place', () => {
      const conn = open();
      conn.write(['a', 'b'], { hasNextPage: true });
      conn.write(['b', 'c'], { after: 'after-b' });

      expect(conn.state()).toEqual(ABC_LOADED);
    });

    it('takes a cursorless refetch with no next page as the whole list', () => {
      const conn = open();
      conn.write(['a', 'b'], { hasNextPage: true });
      conn.write(['c'], { after: 'after-b' });
      conn.write(['a']);

      expect(conn.state()).toEqual({
        ids: ['a'],
        hasNextPage: false,
        endCursor: 'after-a',
      });
    });
  });

  it.each([
    [
      'ShoppingList.itemsConnection',
      listItems,
      {},
      { filters: { purchased: true } },
    ],
    [
      'Pantry.itemsConnection',
      pantryItems,
      { orderBy: 'NAME_ASC' },
      { orderBy: 'NAME_DESC' },
    ],
    ['Query.recipes', recipes, {}, { filters: { category: 'DESSERT' } }],
  ])(
    'keeps each key argument of %s in its own entry',
    (_name, open, one, other) => {
      const conn = open();
      conn.write(['a', 'b'], { variables: one });
      conn.write(['b', 'a'], { variables: other });

      expect(conn.ids(one)).toEqual(['a', 'b']);
      expect(conn.ids(other)).toEqual(['b', 'a']);
    },
  );

  // Forward-only paging can never bring a dropped row back.
  describe.each([
    ['ShoppingList.itemsConnection', listItems, 130, 25],
    ['Pantry.itemsConnection', pantryItems, 250, 100],
  ])('%s past one page', (_name, open, total, pageSize) => {
    const all = Array.from({ length: total }, (_, i) => `r${i}`);
    const loadAll = () => {
      const conn = open();
      for (let start = 0; start < total; start += pageSize) {
        conn.write(all.slice(start, start + pageSize), {
          after: start === 0 ? undefined : `after-r${start - 1}`,
          hasNextPage: start + pageSize < total,
          totalCount: total,
        });
      }
      return conn;
    };

    it('keeps every row in order, through a refetch of its first page', () => {
      const conn = loadAll();
      expect(conn.ids()).toEqual(all);

      conn.write(all.slice(0, pageSize), {
        hasNextPage: true,
        totalCount: total,
      });
      expect(conn.ids()).toEqual(all);
    });

    it('holds every row through a persist and a restore', () => {
      const reopened = open();
      reopened.cache.restore(loadAll().cache.extract());

      expect(reopened.ids()).toEqual(all);
    });
  });

  describe('Home.shoppingListsConnection', () => {
    it("takes a refetched row's new fields and keeps the page after it", () => {
      const lists = homeLists();
      lists.write(['a'], { hasNextPage: true });
      lists.write(['b'], { after: 'after-a' });
      lists.write([{ id: 'a', name: 'Renamed' }], { hasNextPage: true });

      expect(lists.ids()).toEqual(['a', 'b']);
      expect(lists.read()?.edges[0]?.node.name).toBe('Renamed');
    });

    it('reads the totalCount of the latest answer', () => {
      const lists = homeLists();
      lists.write(['a', 'b'], { hasNextPage: true, totalCount: 5 });
      expect(lists.read()?.totalCount).toBe(5);

      lists.write(['c'], { after: 'after-b', totalCount: 5 });
      expect(lists.read()?.totalCount).toBe(5);

      lists.write(['a', 'b'], { hasNextPage: true, totalCount: 3 });
      expect(lists.read()?.totalCount).toBe(3);
    });

    it('reads the same object after a refetch that changes nothing', () => {
      const lists = homeLists();
      lists.write(['a', 'b'], { hasNextPage: true, totalCount: 5 });
      const before = lists.read();

      lists.write(['a', 'b'], { hasNextPage: true, totalCount: 5 });
      expect(lists.read()).toBe(before);
    });

    it('reads a new object after a refetch that changes only totalCount', () => {
      const lists = homeLists();
      lists.write(['a'], { hasNextPage: true, totalCount: 3 });
      const before = lists.read();

      lists.write(['a'], { hasNextPage: true, totalCount: 5 });
      expect(lists.read()).not.toBe(before);
      expect(lists.read()).toEqual({ ...before, totalCount: 5 });
    });
  });

  describe('ShoppingList.itemsConnection', () => {
    it('keeps its cursor when a repeated fetchMore answers only rows it holds', () => {
      const items = listItems();
      items.write(['a', 'b'], { hasNextPage: true });
      items.write(['c'], { after: 'after-b' });
      // A race resends `after-b`; answered from there, more pages do follow.
      items.write(['c'], { after: 'after-b', hasNextPage: true });

      expect(items.state()).toEqual(ABC_LOADED);
    });

    it('accumulates a fetchMore page through a client', async () => {
      const items = listItems();
      const client = new ApolloClient({
        cache: items.cache,
        defaultOptions: APOLLO_DEFAULT_OPTIONS,
        link: testMockLink([
          {
            request: { query: LIST_ITEMS, variables: { id: LIST.id } },
            result: { data: items.answer(['a'], { hasNextPage: true }) },
          },
          {
            request: {
              query: LIST_ITEMS,
              variables: { id: LIST.id, after: 'after-a' },
            },
            result: { data: items.answer(['b']) },
          },
        ]),
      });

      await client.query({ query: LIST_ITEMS, variables: { id: LIST.id } });
      expect(items.ids()).toEqual(['a']);

      await client
        .watchQuery({ query: LIST_ITEMS, variables: { id: LIST.id } })
        .fetchMore({ variables: { after: 'after-a' } });
      expect(items.ids()).toEqual(['a', 'b']);
    });
  });

  describe('Query.recipes', () => {
    it('lets a variable-less updateQuery reach the entry a variable-less read resolves', () => {
      const list = recipes();
      list.write(['a']);

      // recipeCacheWriters' pattern: cache.updateQuery({ query }), no variables.
      list.cache.updateQuery<{ recipes?: Connection }>(
        { query: RECIPES },
        data =>
          data?.recipes
            ? {
                recipes: {
                  ...data.recipes,
                  edges: [
                    ...data.recipes.edges,
                    ...connection('Recipe', ['b']).edges,
                  ],
                },
              }
            : data,
      );

      expect(list.ids()).toEqual(['a', 'b']);
    });
  });

  describe('pantryItemBatchesConnection shared by two operations', () => {
    // A detail write selecting no pageInfo strips it off the shared field, and
    // the history read goes permanently incomplete: offline it renders empty
    // over a cache holding every batch.
    it.each(['history', 'detail'])(
      'keeps the history read complete when the %s query writes first',
      first => {
        const cache = makeCache();
        const history = batchHistory(cache);
        const detail = batchDetail(cache);
        if (first === 'detail') detail.write(['a']);
        history.write(['a'], { hasNextPage: true });
        if (first === 'history') detail.write(['a']);

        expect(history.ids()).toEqual(['a']);
      },
    );

    it("does not let the history's narrower page truncate the detail window", () => {
      const cache = makeCache();
      batchDetail(cache).write(['a', 'b', 'c']);
      batchHistory(cache).write(['a'], { hasNextPage: true });

      expect(batchDetail(cache).ids()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('a page of rows the device has never held, each selecting its parent', () => {
    it.each([
      ['a list (itemsConnectionFieldPolicy)', listRows, { shoppingList: LIST }],
      ['a home (mergeConnectionByNodeId)', homeRows, { home: HOME }],
    ])('appends them on %s', (_name, open, parent) => {
      const conn = open();
      const rows = (ids: string[]) => ids.map(id => ({ id, ...parent }));
      conn.write(rows(['a', 'b']), { hasNextPage: true, totalCount: 4 });
      conn.write(rows(['c', 'd']), { after: 'after-b', totalCount: 4 });

      expect(conn.state()).toEqual({
        ids: ['a', 'b', 'c', 'd'],
        hasNextPage: false,
        endCursor: 'after-d',
      });
    });
  });
});
