import { InMemoryCache, gql, isReference } from '@apollo/client';
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
