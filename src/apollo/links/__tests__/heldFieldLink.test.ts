import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { seedQuery } from '#/test-utils/apolloMockProvider';
import { createHeldFieldLink } from '../heldFieldLink';

const ROW = gql`
  query HeldRow($id: ID!) {
    pantryItem(id: $id) {
      id
      itemName
      storageNotes
      brand {
        id
        name
      }
      tags
    }
  }
`;

const LIST = gql`
  query HeldList {
    shoppingLists(first: 2) {
      edges {
        cursor
        node {
          id
          name
          description
        }
      }
    }
  }
`;

const VARIABLES = { id: 'item-1' };

const HELD = {
  __typename: 'PantryItem',
  id: 'item-1',
  itemName: 'Milk',
  storageNotes: 'top shelf',
  brand: { __typename: 'Brand', id: 'brand-1', name: 'Good Farm' },
  tags: ['dairy'],
};

function clientAnswering(
  query: typeof ROW,
  variables: Record<string, unknown>,
  data: Record<string, unknown> | null,
  errors: GraphQLError[],
) {
  return new ApolloClient({
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([
      createHeldFieldLink(),
      new MockLink([
        { request: { query, variables }, result: { data, errors } },
      ]),
    ]),
  });
}

const failed = (path: (string | number)[]) =>
  new GraphQLError('Could not resolve', { path });

const shown = (client: ApolloClient) =>
  client.cache.readQuery<{ pantryItem: typeof HELD }>({
    query: ROW,
    variables: VARIABLES,
    optimistic: false,
  })?.pantryItem;

const fetchRow = (client: ApolloClient) =>
  client.query({
    query: ROW,
    variables: VARIABLES,
    fetchPolicy: 'network-only',
  });

describe('a partial answer', () => {
  it('keeps a field that failed, lands the rest, and still reports the failure', async () => {
    const client = clientAnswering(
      ROW,
      VARIABLES,
      { pantryItem: { ...HELD, itemName: 'Oat milk', storageNotes: null } },
      [failed(['pantryItem', 'storageNotes'])],
    );
    seedQuery(client.cache, {
      query: ROW,
      variables: VARIABLES,
      data: { pantryItem: HELD },
    });

    const { error } = await fetchRow(client);

    expect(shown(client)).toMatchObject({
      itemName: 'Oat milk',
      storageNotes: 'top shelf',
    });
    expect(error).toBeDefined();
  });

  it('keeps a record a failure below it nulled', async () => {
    const client = clientAnswering(
      ROW,
      VARIABLES,
      { pantryItem: { ...HELD, itemName: 'Oat milk', brand: null } },
      [failed(['pantryItem', 'brand', 'name'])],
    );
    seedQuery(client.cache, {
      query: ROW,
      variables: VARIABLES,
      data: { pantryItem: HELD },
    });

    await fetchRow(client);

    expect(shown(client)).toMatchObject({
      itemName: 'Oat milk',
      brand: { id: 'brand-1', name: 'Good Farm' },
    });
  });

  it('matches a connection’s row by its node, wherever the answer put it', async () => {
    const edge = (id: string, description: string | null, name = id) => ({
      __typename: 'ShoppingListEdge',
      cursor: id,
      node: { __typename: 'ShoppingList', id, name, description },
    });
    const connection = (...edges: ReturnType<typeof edge>[]) => ({
      shoppingLists: { __typename: 'ShoppingListConnection', edges },
    });
    const client = clientAnswering(
      LIST,
      {},
      connection(edge('b', null, 'B moved'), edge('a', 'a')),
      [failed(['shoppingLists', 'edges', 0, 'node', 'description'])],
    );
    seedQuery(client.cache, {
      query: LIST,
      data: connection(edge('a', 'a'), edge('b', 'held')),
    });

    await client.query({ query: LIST, fetchPolicy: 'network-only' });

    const answered = client.cache.readQuery<ReturnType<typeof connection>>({
      query: LIST,
      optimistic: false,
    });
    expect(
      answered?.shoppingLists.edges.find(({ node }) => node.id === 'b')?.node,
    ).toMatchObject({ name: 'B moved', description: 'held' });
  });

  it('lands as it came when the device holds no complete copy', async () => {
    const client = clientAnswering(
      ROW,
      VARIABLES,
      { pantryItem: { ...HELD, storageNotes: null } },
      [failed(['pantryItem', 'storageNotes'])],
    );

    await fetchRow(client);

    expect(shown(client)?.storageNotes).toBeNull();
  });

  it('leaves an answer with no failure alone', async () => {
    const client = clientAnswering(
      ROW,
      VARIABLES,
      { pantryItem: { ...HELD, storageNotes: null } },
      [],
    );
    seedQuery(client.cache, {
      query: ROW,
      variables: VARIABLES,
      data: { pantryItem: HELD },
    });

    await fetchRow(client);

    expect(shown(client)?.storageNotes).toBeNull();
  });
});
