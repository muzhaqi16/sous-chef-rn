'use no memo';
/**
 * The operation safelist hashes the text the server receives on BOTH
 * transports: an HTTP body and a graphql-ws subscribe. The manifest hashes
 * every document with its definitions sorted, so a subscription that spreads a
 * fragment is refused unless the WS branch sorts too.
 */
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { sortTopLevelDefinitions } from '@apollo/persisted-query-lists';
import { Kind, parse, print } from 'graphql';
import type { DefinitionNode } from 'graphql';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createTransportLink } from '../transportLink';

interface MockSent {
  transport: 'ws' | 'http';
  body: string;
  hasPersistedQuery: boolean;
}

const mockSent: MockSent[] = [];

function mockCapturingLink(transport: MockSent['transport']) {
  const { ApolloLink } = jest.requireActual('@apollo/client');
  const graphql = jest.requireActual('graphql');
  const { Observable } = jest.requireActual('rxjs');
  return new ApolloLink(
    (operation: {
      query: import('graphql').DocumentNode;
      extensions: Record<string, unknown>;
    }) => {
      mockSent.push({
        transport,
        body: graphql.print(operation.query),
        hasPersistedQuery: operation.extensions.persistedQuery !== undefined,
      });
      return new Observable(
        (observer: { next: (v: unknown) => void; complete: () => void }) => {
          observer.next({ data: null });
          observer.complete();
        },
      );
    },
  );
}

jest.mock('../wsLink', () => ({ wsLink: mockCapturingLink('ws') }));
jest.mock('../httpLink', () => ({
  createHttpLink: () => mockCapturingLink('http'),
}));

const definitionNames = (body: string) =>
  parse(body).definitions.map((d: DefinitionNode) =>
    d.kind === Kind.OPERATION_DEFINITION || d.kind === Kind.FRAGMENT_DEFINITION
      ? d.name?.value
      : d.kind,
  );

// Fragments in reference order, as codegen emits them: Zed before Alpha.
const UNSORTED_FRAGMENTS = `
  fragment Zed on PantryEvent { id }
  fragment Alpha on PantryEvent { kind }
`;

function buildClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: createTransportLink(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
}

describe('createTransportLink', () => {
  beforeEach(() => {
    mockSent.length = 0;
  });

  it('sends a subscription over WS with its definitions in manifest order', async () => {
    const client = buildClient();

    await new Promise<void>(resolve => {
      client
        .subscribe({
          query: parse(
            `subscription PantryEvents { pantryEvents { ...Zed ...Alpha } } ${UNSORTED_FRAGMENTS}`,
          ),
          fetchPolicy: 'no-cache',
        })
        .subscribe({ complete: resolve, error: () => resolve() });
    });

    expect(mockSent).toHaveLength(1);
    const sent = mockSent[0]!;
    expect(sent.transport).toBe('ws');
    expect(sent.hasPersistedQuery).toBe(false);
    expect(definitionNames(sent.body)).toEqual([
      'PantryEvents',
      'Alpha',
      'Zed',
    ]);
    // What the manifest generator hashes for the same document.
    expect(sent.body).toBe(print(sortTopLevelDefinitions(parse(sent.body))));
  });

  it('sends a query over HTTP with an APQ hash and sorted definitions', async () => {
    const client = buildClient();

    await client
      .query({
        query: parse(
          `query GetPantry { pantry { ...Zed ...Alpha } } ${UNSORTED_FRAGMENTS}`,
        ),
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      })
      .catch(() => undefined);

    expect(mockSent).toHaveLength(1);
    const sent = mockSent[0]!;
    expect(sent.transport).toBe('http');
    expect(sent.hasPersistedQuery).toBe(true);
    expect(definitionNames(sent.body)).toEqual(['GetPantry', 'Alpha', 'Zed']);
  });
});
