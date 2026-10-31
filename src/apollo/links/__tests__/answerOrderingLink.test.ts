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

const SHOPPING_LINE = gql`
  query ProbeLine {
    probeLine {
      id
      version
      itemName
      purchaseInfo {
        isPurchased
        purchasedPrice
      }
      unit {
        id
        symbol
      }
      item {
        id
        version
        name
      }
      tags {
        label
      }
    }
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

const shoppingLine = (
  version: number,
  overrides: Record<string, unknown> = {},
) => ({
  __typename: 'ShoppingListItem',
  id: 'line-1',
  version,
  itemName: 'Milk',
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: true,
    purchasedPrice: 2,
  },
  unit: { __typename: 'Unit', id: 'unit-l', symbol: 'l' },
  item: { __typename: 'Item', id: 'item-1', version: 1, name: 'Milk' },
  tags: [{ __typename: 'Tag', label: 'dairy' }],
  ...overrides,
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

  describe('the object fields of a row the answer has an older copy of', () => {
    const afterAnswer = async (
      held: Record<string, unknown>,
      answer: Record<string, unknown>,
    ) => {
      const { cache, read } = client([{ probeLine: answer }]);
      seedQuery(cache, { query: SHOPPING_LINE, data: { probeLine: held } });
      await read(SHOPPING_LINE);
      return cache.readQuery<{ probeLine: unknown }>({ query: SHOPPING_LINE })
        ?.probeLine;
    };

    it('keeps a confirmed tick, which an embedded object carries', async () => {
      const held = shoppingLine(2);
      const answer = shoppingLine(1, {
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
          purchasedPrice: null,
        },
      });

      expect(await afterAnswer(held, answer)).toEqual(held);
    });

    it('keeps the answer’s value for a key the device’s embedded object lacks', async () => {
      const { cache, read } = client([
        {
          probeLine: shoppingLine(1, {
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: false,
              purchasedPrice: 3,
            },
          }),
        },
      ]);
      seedFragment(cache, {
        fragment: gql`
          fragment ProbeTick on ShoppingListItem {
            id
            version
            purchaseInfo {
              isPurchased
            }
          }
        `,
        data: {
          __typename: 'ShoppingListItem',
          id: 'line-1',
          version: 2,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        },
      });

      const answered = await read(SHOPPING_LINE);

      expect(answered.data).toMatchObject({
        probeLine: { purchaseInfo: { isPurchased: true, purchasedPrice: 3 } },
      });
    });

    it('keeps the row a newer copy points at', async () => {
      const liters = { __typename: 'Unit', id: 'unit-l', symbol: 'l' };
      const cups = { __typename: 'Unit', id: 'unit-c', symbol: 'cup' };
      const held = shoppingLine(2, { unit: liters });

      expect(await afterAnswer(held, shoppingLine(1, { unit: cups }))).toEqual(
        held,
      );
    });

    it('keeps a pointer a newer copy cleared', async () => {
      const held = shoppingLine(2, { unit: null });

      expect(await afterAnswer(held, shoppingLine(1))).toEqual(held);
    });

    it('keeps an embedded list, which has no membership of its own', async () => {
      const held = shoppingLine(2, {
        tags: [{ __typename: 'Tag', label: 'organic' }],
      });

      expect(await afterAnswer(held, shoppingLine(1))).toEqual(held);
    });

    it('judges a row the field still points at on its own', async () => {
      const newerItem = {
        __typename: 'Item',
        id: 'item-1',
        version: 9,
        name: 'Oat milk',
      };
      const held = shoppingLine(2);

      expect(
        await afterAnswer(held, shoppingLine(1, { item: newerItem })),
      ).toEqual({ ...held, item: newerItem });
    });

    it('keeps the answer’s pointer over a row the device holds in part', async () => {
      const cups = { __typename: 'Unit', id: 'unit-c', symbol: 'cup' };
      const { cache, read } = client([{ probeLine: shoppingLine(1) }]);
      seedFragment(cache, {
        fragment: gql`
          fragment ProbePointer on ShoppingListItem {
            id
            version
            unit {
              id
            }
          }
        `,
        data: {
          __typename: 'ShoppingListItem',
          id: 'line-1',
          version: 2,
          unit: { __typename: 'Unit', id: cups.id },
        },
      });

      const answered = await read(SHOPPING_LINE);

      expect(answered.data).toMatchObject({
        probeLine: { unit: { id: 'unit-l', symbol: 'l' } },
      });
    });

    it('lands a connection as answered', async () => {
      const CONNECTION = gql`
        query ProbeRows {
          probeList {
            id
            version
            itemsConnection(first: 5) {
              totalCount
              edges {
                node {
                  id
                  version
                  itemName
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
      const list = (version: number, rows: ReturnType<typeof line>[]) => ({
        __typename: 'ShoppingList',
        id: 'list-1',
        version,
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          totalCount: rows.length,
          edges: rows.map(node => ({
            __typename: 'ShoppingListItemEdge',
            node,
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      });
      const answer = list(1, [line('l2', 1, 'Bread')]);
      const { cache, read } = client([{ probeList: answer }]);
      seedQuery(cache, {
        query: CONNECTION,
        data: { probeList: list(2, [line('l1', 1, 'Eggs')]) },
      });

      await read(CONNECTION);

      expect(cache.readQuery({ query: CONNECTION })).toEqual({
        probeList: { ...answer, version: 2 },
      });
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
