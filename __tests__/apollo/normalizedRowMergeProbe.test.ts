import {
  InMemoryCache,
  gql,
  isReference,
  type Reference,
} from '@apollo/client';
import { makeCache } from '#/apollo/cache';

/**
 * What a type-level `merge` receives for a normalized row, and what an older
 * copy of the row does to the cache with nothing guarding it.
 * Apollo Client 4.2.12. Recorded in docs/verified-library-behaviour.md.
 */

const ROW = gql`
  query ProbeRow {
    probeRow {
      id
      version
      name
    }
  }
`;

const LIST = gql`
  query ProbeRows {
    probeRows {
      id
      version
      name
    }
  }
`;

const ROW_FIELDS = gql`
  fragment ProbeRowFields on ShoppingListItem {
    id
    version
    name
  }
`;

const row = (version: number, name: string) => ({
  __typename: 'ShoppingListItem',
  id: 'sli-1',
  version,
  name,
});

/** Each call the type-level `merge` received. */
type Seen = Array<{ existing: unknown; incoming: unknown }>;

const caches = {
  'a plain InMemoryCache': () => new InMemoryCache(),
  'makeCache()': () => makeCache(),
};

describe.each(Object.entries(caches))(
  'a type-level merge on a normalized row (%s)',
  (_name, create) => {
    const setUp = () => {
      const seen: Seen = [];
      const cache = create();
      cache.policies.addTypePolicies({
        ShoppingListItem: {
          merge(existing, incoming, { mergeObjects }) {
            seen.push({ existing, incoming });
            return mergeObjects(existing, incoming);
          },
        },
      });
      return { cache, seen };
    };

    it('sees references, never the row’s fields', () => {
      const { cache, seen } = setUp();

      cache.writeQuery({ query: ROW, data: { probeRow: row(2, 'Milk') } });
      cache.writeQuery({ query: ROW, data: { probeRow: row(1, 'Bread') } });
      cache.writeQuery({ query: LIST, data: { probeRows: [row(1, 'Bread')] } });

      expect(seen.length).toBeGreaterThan(0);
      for (const { existing, incoming } of seen) {
        expect(isReference(incoming)).toBe(true);
        expect(existing === undefined || isReference(existing)).toBe(true);
      }
    });

    it('lets an older copy of the row replace a newer one', () => {
      const { cache } = setUp();

      cache.writeQuery({ query: ROW, data: { probeRow: row(2, 'Milk') } });
      cache.writeQuery({ query: LIST, data: { probeRows: [row(1, 'Bread')] } });

      expect(
        cache.readFragment({
          id: cache.identify(row(0, '')),
          fragment: ROW_FIELDS,
        }),
      ).toEqual(row(1, 'Bread'));
    });
  },
);

describe('a field merge on a list, for a row the same write brings', () => {
  const WITH_PARENT = gql`
    query ProbeWithParent {
      probeList {
        id
        rows {
          id
          list {
            id
          }
        }
      }
    }
  `;
  const WITHOUT_PARENT = gql`
    query ProbeWithoutParent {
      probeList {
        id
        rows {
          id
        }
      }
    }
  `;
  const listOf = (withParent: boolean) => ({
    probeList: {
      __typename: 'ProbeList',
      id: 'list-1',
      rows: [
        {
          __typename: 'ProbeRow',
          id: 'row-1',
          ...(withParent && {
            list: { __typename: 'ProbeList', id: 'list-1' },
          }),
        },
      ],
    },
  });

  const idsTheMergeReads = (withParent: boolean) => {
    const seen: unknown[] = [];
    const cache = new InMemoryCache({
      typePolicies: {
        ProbeList: {
          fields: {
            rows: {
              merge(_existing: unknown, incoming: readonly Reference[], opts) {
                incoming.forEach(ref => seen.push(opts.readField('id', ref)));
                return incoming;
              },
            },
          },
        },
      },
    });
    cache.writeQuery({
      query: withParent ? WITH_PARENT : WITHOUT_PARENT,
      data: listOf(withParent),
    });
    return seen;
  };

  it('reads the row when the row is stored first', () => {
    expect(idsTheMergeReads(false)).toEqual(['row-1']);
  });

  it('reads nothing when the row selects the list, which is stored first', () => {
    expect(idsTheMergeReads(true)).toEqual([undefined]);
  });
});

const TWO_COPIES = gql`
  query ProbeResults {
    probeResults {
      row {
        id
        version
        name
      }
    }
  }
`;

describe.each(Object.entries(caches))(
  'one answer holding two copies of a row (%s)',
  (_name, create) => {
    it('stores the first copy and drops the later, newer one', () => {
      const cache = create();
      cache.writeQuery({
        query: TWO_COPIES,
        data: {
          probeResults: [
            { __typename: 'ProbeResult', row: row(2, 'first') },
            { __typename: 'ProbeResult', row: row(3, 'second') },
          ],
        },
      });

      expect(cache.extract()['ShoppingListItem:sli-1']).toMatchObject({
        version: 2,
        name: 'first',
      });
    });

    it('takes each copy when the two arrive in separate answers', () => {
      const cache = create();
      cache.writeQuery({ query: ROW, data: { probeRow: row(2, 'first') } });
      cache.writeQuery({ query: ROW, data: { probeRow: row(3, 'second') } });

      expect(cache.extract()['ShoppingListItem:sli-1']).toMatchObject({
        version: 3,
        name: 'second',
      });
    });
  },
);
