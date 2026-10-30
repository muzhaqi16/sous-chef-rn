import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createAnswerOrderingLink } from '../answerOrderingLink';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const ITEM = gql`
  query ProbeItem {
    probeItem {
      id
      version
      name
      storeDepartment
    }
  }
`;

const LIST = gql`
  query ProbeList {
    probeList {
      id
      version
      name
      lines {
        id
        version
        itemName
      }
    }
  }
`;

const SPREAD = gql`
  query ProbeSpread {
    probeItem {
      ...ProbeItemFields
      ... on Item {
        storeDepartment
      }
    }
  }
  fragment ProbeItemFields on Item {
    id
    version
    name
  }
`;

const UNVERSIONED = gql`
  query ProbeUnit {
    probeUnit {
      id
      symbol
    }
  }
`;

const item = (version: number, name: string, storeDepartment = 'DAIRY') => ({
  __typename: 'Item',
  id: 'item-1',
  version,
  name,
  storeDepartment,
});

const line = (id: string, version: number, itemName: string) => ({
  __typename: 'ShoppingListItem',
  id,
  version,
  itemName,
});

/** A client whose network answers each read with the next queued answer. */
function client(answers: unknown[]) {
  const cache = makeCache();
  const terminal = new ApolloLink(
    () =>
      new Observable(observer => {
        observer.next({ data: answers.shift() as Record<string, unknown> });
        observer.complete();
      }),
  );
  const apollo = new ApolloClient({
    cache,
    link: ApolloLink.from([createAnswerOrderingLink(), terminal]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const read = (query: DocumentNode) =>
    apollo.query({ query, fetchPolicy: 'network-only' });
  return { cache, read };
}

describe('answerOrderingLink', () => {
  it('keeps a confirmed change when an answer from before it arrives late', async () => {
    const { cache, read } = client([{ probeItem: item(1, 'Milk', 'OTHER') }]);
    // The server confirmed the person's change at version 2.
    seedQuery(cache, {
      query: ITEM,
      data: { probeItem: item(2, 'Milk', 'DAIRY') },
    });

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(2, 'Milk', 'DAIRY'),
    });
  });

  it('keeps a newer copy when answers arrive out of order', async () => {
    const { cache, read } = client([{ probeItem: item(2, 'Whole milk') }]);
    seedQuery(cache, { query: ITEM, data: { probeItem: item(3, 'Oat milk') } });

    const answered = await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(3, 'Oat milk'),
    });
    // The caller sees what the cache holds.
    expect(answered.data).toEqual({ probeItem: item(3, 'Oat milk') });
  });

  it('lands a list, with each row inside it keeping its newer copy', async () => {
    const { cache, read } = client([
      {
        probeList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          version: 4,
          name: 'Weekly',
          lines: [line('l1', 1, 'Eggs'), line('l2', 5, 'Bread')],
        },
      },
    ]);
    seedQuery(cache, {
      query: LIST,
      data: {
        probeList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          version: 4,
          name: 'Weekly',
          lines: [line('l1', 2, 'Free-range eggs')],
        },
      },
    });

    await read(LIST);

    expect(cache.readQuery({ query: LIST })).toEqual({
      probeList: {
        __typename: 'ShoppingList',
        id: 'list-1',
        version: 4,
        name: 'Weekly',
        lines: [line('l1', 2, 'Free-range eggs'), line('l2', 5, 'Bread')],
      },
    });
  });

  it('lands another member’s newer change', async () => {
    const { cache, read } = client([{ probeItem: item(4, 'Skimmed milk') }]);
    seedQuery(cache, { query: ITEM, data: { probeItem: item(3, 'Milk') } });

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(4, 'Skimmed milk'),
    });
  });

  it('lands a field the server changes without a new version', async () => {
    const { cache, read } = client([
      { probeItem: item(3, 'Milk', 'BEVERAGES') },
    ]);
    seedQuery(cache, {
      query: ITEM,
      data: { probeItem: item(3, 'Milk', 'DAIRY') },
    });

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(3, 'Milk', 'BEVERAGES'),
    });
  });

  it('keeps the answer’s value for a field the device does not hold', async () => {
    const { cache, read } = client([{ probeItem: item(1, 'Milk', 'DAIRY') }]);
    seedFragment(cache, {
      id: 'Item:item-1',
      fragment: gql`
        fragment ProbeHeld on Item {
          id
          version
          name
        }
      `,
      data: { __typename: 'Item', id: 'item-1', version: 2, name: 'Oat milk' },
    });

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(2, 'Oat milk', 'DAIRY'),
    });
  });

  it('judges against the server’s copy, never an optimistic layer above it', async () => {
    const { cache, read } = client([{ probeItem: item(2, 'From the server') }]);
    seedQuery(cache, { query: ITEM, data: { probeItem: item(1, 'Milk') } });
    cache.recordOptimisticTransaction(layer => {
      layer.writeQuery({
        query: ITEM,
        data: { probeItem: item(9, 'Pending') },
      });
    }, 'pending-write');

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM }, false)).toEqual({
      probeItem: item(2, 'From the server'),
    });
    cache.removeOptimistic('pending-write');
  });

  it('follows named and inline fragments', async () => {
    const { cache, read } = client([{ probeItem: item(1, 'Milk', 'OTHER') }]);
    seedQuery(cache, {
      query: SPREAD,
      data: { probeItem: item(2, 'Oat milk', 'DAIRY') },
    });

    await read(SPREAD);

    expect(cache.readQuery({ query: SPREAD })).toEqual({
      probeItem: item(2, 'Oat milk', 'DAIRY'),
    });
  });

  it('lands a row when either copy has no version', async () => {
    const { cache, read } = client([{ probeItem: item(1, 'Milk') }]);
    seedFragment(cache, {
      id: 'Item:item-1',
      fragment: gql`
        fragment ProbeUnversioned on Item {
          id
          name
        }
      `,
      data: { __typename: 'Item', id: 'item-1', name: 'Oat milk' },
    });

    await read(ITEM);

    expect(cache.readQuery({ query: ITEM })).toEqual({
      probeItem: item(1, 'Milk'),
    });
  });

  it('passes an answer with no versioned row through as it came', async () => {
    const unit = { __typename: 'Unit', id: 'u-1', symbol: 'kg' };
    const answer = { probeUnit: unit };
    const { read } = client([answer]);

    const answered = await read(UNVERSIONED);

    expect(answered.data).toEqual({ probeUnit: unit });
  });
});
