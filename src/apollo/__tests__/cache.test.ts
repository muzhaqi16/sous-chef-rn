'use no memo';

jest.mock('#/graphql/generated/fragmentMatcher.json', () => ({
  possibleTypes: {},
}));

import { InMemoryCache } from '@apollo/client';
import { parse, type DocumentNode } from 'graphql';
import { makeCache } from '../cache';
import { typedConnectionOf } from '#/test-utils/fixtures/connectionOf';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

interface Page {
  after?: string;
  hasNextPage?: boolean;
  endCursor?: string | null;
  totalCount?: number | null;
}

interface ConnectionRead {
  edges: { node: { id: string } }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const CONNECTION =
  'totalCount edges { node { id } } pageInfo { hasNextPage endCursor }';

/** One page of `type` rows; a `null` count is one the server did not state. */
const pageOf = (
  type: string,
  ids: string[],
  { totalCount = ids.length, ...page }: Omit<Page, 'after'> = {},
) => ({
  ...typedConnectionOf(
    type,
    ids.map(id => ({ __typename: type, id })),
    page,
  ),
  totalCount,
});

const idsOf = (connection: ConnectionRead | undefined) =>
  connection?.edges.map(edge => edge.node.id);

const idRange = (prefix: string, count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => `${prefix}${from + i}`);

/** `<parent>(id).<field>(after:)` as a screen pages it, on a fresh cache. */
const pagedConnection = (
  parentType: string,
  field: string,
  nodeType: string,
) => {
  const root = parentType.charAt(0).toLowerCase() + parentType.slice(1);
  const query = parse(
    `query Paged($id: ID!, $after: String) { ${root}(id: $id) { id ${field}(after: $after) { ${CONNECTION} } } }`,
  );
  return () => {
    const cache = makeCache();
    const read = () =>
      cache.readQuery<Record<string, Record<string, ConnectionRead>>>({
        query,
        variables: { id: 'p1' },
      })?.[root]?.[field];
    return {
      write: (ids: string[], { after, ...page }: Page = {}) =>
        seedQuery(cache, {
          query,
          variables: { id: 'p1', after },
          data: {
            [root]: {
              __typename: parentType,
              id: 'p1',
              [field]: pageOf(nodeType, ids, page),
            },
          },
        }),
      ids: () => idsOf(read()),
      pageInfo: () => read()?.pageInfo,
    };
  };
};

const LISTS_QUERY = parse(
  `query Lists($homeId: ID, $first: Int) { shoppingLists(homeId: $homeId, first: $first) { ${CONNECTION} } }`,
);

describe('makeCache', () => {
  it('returns an InMemoryCache', () => {
    expect(makeCache()).toBeInstanceOf(InMemoryCache);
  });
});

describe.each([
  ['Home', 'shoppingListsConnection', 'ShoppingList'],
  ['ShoppingList', 'itemsConnection', 'ShoppingListItem'],
  ['Pantry', 'itemsConnection', 'PantryItem'],
])('%s.%s', (parentType, field, nodeType) => {
  const open = pagedConnection(parentType, field, nodeType);

  it('dedupes a row the next page restates', () => {
    const list = open();
    list.write(['n1', 'n2'], { hasNextPage: true, endCursor: 'c2' });
    list.write(['n2', 'n3'], { after: 'c2', endCursor: 'c3' });

    expect(list.ids()).toEqual(['n1', 'n2', 'n3']);
    expect(list.pageInfo()).toMatchObject({
      hasNextPage: false,
      endCursor: 'c3',
    });
  });

  it('keeps the later pages when page 1 is refetched with more to come', () => {
    const list = open();
    list.write(['n1', 'n2'], { hasNextPage: true, endCursor: 'c2' });
    list.write(['n3'], { after: 'c2', endCursor: 'c3' });
    list.write(['n1', 'n2'], { hasNextPage: true, endCursor: 'c2' });

    expect(list.ids()).toEqual(['n1', 'n2', 'n3']);
    // The loaded window still ends where the last page left it.
    expect(list.pageInfo()).toMatchObject({
      hasNextPage: false,
      endCursor: 'c3',
    });
  });

  it('replaces the whole list when a refetch has no next page', () => {
    const list = open();
    list.write(['n1'], { hasNextPage: true, endCursor: 'c1' });
    list.write(['n2'], { after: 'c1', endCursor: 'c2' });
    list.write(['n1'], { endCursor: 'c1' });

    expect(list.ids()).toEqual(['n1']);
  });

  // `hasNextPage` on a restated page is what a derived write refuses on.
  it('takes the hasNextPage of a restated page that now has more', () => {
    const list = open();
    list.write(['n1', 'n2']);
    list.write(['n1', 'n2'], { hasNextPage: true, endCursor: 'c2' });

    expect(list.ids()).toEqual(['n1', 'n2']);
    expect(list.pageInfo()).toMatchObject({
      hasNextPage: true,
      endCursor: 'c2',
    });
  });

  it.each([
    [
      'keeps the held rows over an empty page with no count',
      null,
      ['n1', 'n2'],
    ],
    ['clears on an authoritatively empty page', 0, []],
  ])('%s', (_name, totalCount, expected) => {
    const list = open();
    list.write(['n1', 'n2']);
    list.write([], { totalCount });

    expect(list.ids()).toEqual(expected);
  });
});

describe('a cursorless refetch of ShoppingList.itemsConnection is authoritative for the page it covers', () => {
  const open = pagedConnection(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
  /** Two pages loaded, four items, more still to come. */
  const twoPages = () => {
    const list = open();
    list.write(['a', 'b'], { hasNextPage: true, endCursor: 'c2' });
    list.write(['c', 'd'], { after: 'c2', hasNextPage: true, endCursor: 'c4' });
    return list;
  };

  // Every refreshed page states more to come, as on a list long enough to paginate.
  it.each([
    ['drops an entry removed elsewhere', ['a', 'c'], ['a', 'c', 'd']],
    [
      'drops a page-1 entry the refresh no longer lists',
      ['b', 'c'],
      ['b', 'c', 'd'],
    ],
    ['lands an entry that now sorts first', ['d', 'a'], ['d', 'a', 'b', 'c']],
    [
      'keeps the entry an insert at the top pushes past page 1',
      ['n', 'a'],
      ['n', 'a', 'b', 'c', 'd'],
    ],
    ['keeps pages the refresh did not cover', ['a', 'b'], ['a', 'b', 'c', 'd']],
    [
      'replaces the window when the page shares no entry with it',
      ['x', 'y'],
      ['x', 'y'],
    ],
  ])('%s', (_name, page, expected) => {
    const list = twoPages();
    list.write(page, { hasNextPage: true, endCursor: 'c2' });

    expect(list.ids()).toEqual(expected);
  });

  it('skips nothing when fetchMore resumes after the merge', () => {
    const list = twoPages();
    list.write(['n', 'a'], { hasNextPage: true, endCursor: 'c2' });
    // The surviving tail keeps the cached cursor, so the next page follows `d`.
    expect(list.pageInfo()?.endCursor).toBe('c4');

    list.write(['e', 'f'], { after: 'c4', endCursor: 'c6' });

    expect(list.ids()).toEqual(['n', 'a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('restarts from the refreshed page when it meets none of the held rows', () => {
    const list = open();
    // As a persisted blob from a build that capped the list can hold it.
    list.write(idRange('r', 100, 26), { hasNextPage: true, endCursor: 'c125' });
    list.write(idRange('r', 25, 1), { hasNextPage: true, endCursor: 'c25' });

    expect(list.ids()).toEqual(idRange('r', 25, 1));
    expect(list.pageInfo()?.endCursor).toBe('c25');

    list.write(idRange('r', 25, 26), { after: 'c25', hasNextPage: true });

    expect(list.ids()).toEqual(idRange('r', 50, 1));
  });
});

describe('connections keyed on their real arguments', () => {
  it('Query.shoppingLists serves every page size from one held collection per home', () => {
    const cache = makeCache();
    const write = (
      variables: { homeId: string; first: number },
      ids: string[],
      page?: Page,
    ) =>
      seedQuery(cache, {
        query: LISTS_QUERY,
        variables,
        data: { shoppingLists: pageOf('ShoppingList', ids, page) },
      });
    const readIds = (variables: { homeId: string; first: number }) =>
      idsOf(
        cache.readQuery<{ shoppingLists: ConnectionRead }>({
          query: LISTS_QUERY,
          variables,
        })?.shoppingLists,
      );
    write({ homeId: 'h1', first: 50 }, idRange('sl-', 30));
    write({ homeId: 'h2', first: 50 }, ['other']);

    // A picker asking for a smaller page reads what the overview holds,
    // with no request of its own (offline included).
    expect(readIds({ homeId: 'h1', first: 20 })).toEqual(idRange('sl-', 30));

    // Its own first page, when it lands, does not truncate the overview.
    write({ homeId: 'h1', first: 20 }, idRange('sl-', 20), {
      hasNextPage: true,
      totalCount: 30,
    });
    expect(readIds({ homeId: 'h1', first: 50 })).toEqual(idRange('sl-', 30));
    expect(readIds({ homeId: 'h2', first: 20 })).toEqual(['other']);
  });

  it('Pantry.storageLocationsConnection keeps each ordering its own entry', () => {
    const cache = makeCache();
    const query = parse(
      `query Locations($id: ID!, $orderBy: StorageLocationOrderBy) { pantry(id: $id) { id storageLocationsConnection(orderBy: $orderBy) { ${CONNECTION} } } }`,
    );
    const write = (orderBy: Record<string, string>, ids: string[]) =>
      seedQuery(cache, {
        query,
        variables: { id: 'p1', orderBy },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'p1',
            storageLocationsConnection: pageOf('StorageLocation', ids),
          },
        },
      });
    const readIds = (orderBy: Record<string, string>) =>
      idsOf(
        cache.readQuery<{
          pantry: { storageLocationsConnection: ConnectionRead };
        }>({ query, variables: { id: 'p1', orderBy } })?.pantry
          .storageLocationsConnection,
      );
    write({ name: 'ASC' }, ['a', 'b']);
    write({ createdAt: 'DESC' }, ['b', 'a']);

    expect(readIds({ name: 'ASC' })).toEqual(['a', 'b']);
    expect(readIds({ createdAt: 'DESC' })).toEqual(['b', 'a']);
  });
});

describe('a null answer keeps what the cache holds', () => {
  const listWith = (suggestions: object | null) => ({
    shoppingList: { __typename: 'ShoppingList', id: 'list-1', suggestions },
  });

  it.each([
    [
      'Query.shoppingLists',
      LISTS_QUERY,
      { homeId: 'h1' },
      { shoppingLists: pageOf('ShoppingList', ['sl-1']) },
      { shoppingLists: null },
    ],
    [
      'Query.storageLocations',
      parse(
        `query Locations($homeId: ID!) { storageLocations(homeId: $homeId) { ${CONNECTION} } }`,
      ),
      { homeId: 'h1' },
      { storageLocations: pageOf('StorageLocation', ['s1']) },
      { storageLocations: null },
    ],
    [
      'ShoppingList.suggestions',
      parse(
        'query Suggestions($id: ID!) { shoppingList(id: $id) { id suggestions { popular { id name } } } }',
      ),
      { id: 'list-1' },
      listWith({
        __typename: 'ShoppingListSuggestions',
        popular: [
          { __typename: 'ShoppingListSuggestion', id: 'sug-1', name: 'Butter' },
        ],
      }),
      listWith(null),
    ],
  ])('%s', (_field, query, variables, held, answer) => {
    const cache = makeCache();
    seedQuery(cache, { query, variables, data: held });
    seedQuery(cache, { query, variables, data: answer });

    expect(cache.readQuery({ query, variables })).toEqual(held);
  });
});

describe.each([
  ['MealPlan', 'mealPlanItemsConnection', 'MealPlanItem'],
  ['Recipe', 'ingredientsConnection', 'RecipeIngredient'],
])(
  '%s.%s is one list whatever arguments read it',
  (typename, field, nodeType) => {
    const selecting = (args: string) =>
      parse(
        `fragment List on ${typename} { id ${field}${args} { ${CONNECTION} } }`,
      );
    // A screen pages the list; a derived or local write names no arguments.
    const paged = selecting('(first: $first, after: $after)');
    const bare = selecting('');

    const write = (
      cache: InMemoryCache,
      fragment: DocumentNode,
      ids: string[],
      { after, ...page }: Page = {},
    ) =>
      seedFragment(cache, {
        fragment,
        variables: { first: 2, after },
        data: {
          __typename: typename,
          id: 'p1',
          [field]: pageOf(nodeType, ids, page),
        },
      });
    const read = (cache: InMemoryCache, fragment: DocumentNode) =>
      cache.readFragment<Record<string, ConnectionRead>>({
        id: `${typename}:p1`,
        fragment,
        variables: { first: 2 },
      })?.[field];

    it('merges the pages a screen loads into the list a bare selection reads', () => {
      const cache = makeCache();
      write(cache, paged, ['n1', 'n2'], { hasNextPage: true, endCursor: 'c2' });
      write(cache, paged, ['n3'], { after: 'c2' });

      for (const fragment of [bare, paged]) {
        expect(idsOf(read(cache, fragment))).toEqual(['n1', 'n2', 'n3']);
        expect(read(cache, fragment)?.pageInfo.hasNextPage).toBe(false);
      }
    });

    it('reads a list written with no arguments through a selection that carries them', () => {
      const cache = makeCache();
      write(cache, bare, ['n-local']);

      expect(idsOf(read(cache, paged))).toEqual(['n-local']);
    });
  },
);

describe('entity merges', () => {
  /** Writes each `[selection, fields]` to one entity in turn, then reads every selection back. */
  const afterWrites = (typename: string, writes: [string, object][]) => {
    const cache = makeCache();
    const fragmentOf = (selection: string) =>
      parse(`fragment Fields on ${typename} { id ${selection} }`);
    for (const [selection, fields] of writes) {
      seedFragment(cache, {
        fragment: fragmentOf(selection),
        data: { __typename: typename, id: 'e1', ...fields },
      });
    }
    return cache.readFragment({
      id: `${typename}:e1`,
      fragment: fragmentOf(writes.map(([selection]) => selection).join(' ')),
    });
  };
  const imageUrl = 'https://example.com/banana.jpg';
  const media = {
    nutritions: { calories: 100 },
    images: [{ __typename: 'ItemImage', url: 'test.jpg', kind: 'MAIN' }],
    imageUrl,
  };

  it.each<[string, string, [string, object][], object]>([
    [
      'Item keeps the media and nutrition a write omits',
      'Item',
      [
        ['nutritions images { url kind } imageUrl', media],
        ['name', { name: 'Renamed' }],
      ],
      { name: 'Renamed', ...media },
    ],
    [
      'Item.imageUrl clears on an explicit null',
      'Item',
      [
        ['imageUrl', { imageUrl }],
        ['imageUrl', { imageUrl: null }],
      ],
      { imageUrl: null },
    ],
    [
      'ShoppingListItem merges a partial write field-wise',
      'ShoppingListItem',
      [
        ['notes', { notes: 'Oat' }],
        ['version', { version: 2 }],
      ],
      { notes: 'Oat', version: 2 },
    ],
    [
      'User.profile merges a partial profile field-wise',
      'User',
      [
        [
          'profile { displayName avatar }',
          {
            profile: {
              __typename: 'UserProfile',
              displayName: 'John',
              avatar: 'avatar.jpg',
            },
          },
        ],
        [
          'profile { displayName }',
          {
            profile: { __typename: 'UserProfile', displayName: 'John Updated' },
          },
        ],
      ],
      { profile: { displayName: 'John Updated', avatar: 'avatar.jpg' } },
    ],
  ])('%s', (_name, typename, writes, expected) => {
    expect(afterWrites(typename, writes)).toMatchObject(expected);
  });
});

describe.each([
  ['shoppingListItem', 'ShoppingListItem'],
  ['shoppingList', 'ShoppingList'],
  ['pantryItem', 'PantryItem'],
  ['pantry', 'Pantry'],
  ['recipe', 'Recipe'],
  ['home', 'Home'],
])('by-id root field Query.%s', (field, typename) => {
  const query = parse(`query ById($id: ID!) { ${field}(id: $id) { id } }`);
  const variables = { id: 'e1' };
  const read = (cache: InMemoryCache) => cache.readQuery({ query, variables });
  const answerNull = (cache: InMemoryCache) =>
    seedQuery(cache, { query, variables, data: { [field]: null } });
  const writeRow = (cache: InMemoryCache, version: number) =>
    seedFragment(cache, {
      fragment: parse(`fragment Row on ${typename} { id version }`),
      data: { __typename: typename, id: 'e1', version },
    });

  it(`reads null over the ${typename} the device still holds, until another version is written`, () => {
    const cache = makeCache();
    writeRow(cache, 2);
    // Deleted elsewhere: the device missed the removal.
    answerNull(cache);
    expect(read(cache)).toEqual({ [field]: null });

    // As the persisted cache restores it.
    const restored = makeCache();
    restored.restore(cache.extract());
    expect(read(restored)).toEqual({ [field]: null });

    // A list page still carrying the stale copy brings nothing back.
    writeRow(cache, 2);
    expect(read(cache)).toEqual({ [field]: null });

    writeRow(cache, 3);
    expect(read(cache)).toMatchObject({ [field]: { id: 'e1' } });
  });

  // A move answers `shoppingListItem: null` for the line it takes off the
  // list, and an add that reuses that line writes it back under the same id.
  it(`reads a ${typename} written back after the server answered null`, () => {
    const cache = makeCache();
    answerNull(cache);
    expect(read(cache)).toEqual({ [field]: null });

    writeRow(cache, 1);
    expect(read(cache)).toMatchObject({ [field]: { id: 'e1' } });
  });
});
