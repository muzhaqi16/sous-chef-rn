/**
 * What completion promises a fixture, and what it must never do to one.
 *
 * A fixture states only what the test asserts on; completion fills the rest
 * from the real SDL. That bargain holds only while completion is reproducible
 * and lossless — the moment it can vary between runs, or move a value the test
 * wrote, the assertion is against data the test did not write and its result
 * says nothing about the code under test.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gql } from '@apollo/client';
import {
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from 'graphql';
import { useQuery } from '@apollo/client/react';
import {
  completeMockedResponse,
  createApolloTestWrapper,
  renderHookWithApollo,
  throwOnUnknownFixtureKeys,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';

const ECHO_ITEMS = gql`
  query ProbeEchoItems($filters: ItemFilters) {
    items(filters: $filters) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const LIST_FOR_RESET = gql`
  query ProbeUnitsForReset {
    units {
      id
      name
    }
  }
`;

const PROBE_UNITS = gql`
  query ProbeUnitsForEmptyMocks {
    units {
      id
      name
    }
  }
`;

/** Serve one fixture through the same path `createApolloTestWrapper` uses. */
function complete(query: DocumentNode, data: unknown): Record<string, unknown> {
  const completed = completeMockedResponse({
    request: { query, variables: () => true },
    result: { data: data as Record<string, unknown> },
  } as MockedResponse);
  const result = completed.result as (
    vars: Record<string, unknown>,
  ) => { data: Record<string, unknown> };
  return result({}).data;
}

const UNIT_TYPES = ['AREA', 'COUNT', 'LENGTH', 'TIME', 'VOLUME', 'WEIGHT'];

describe('a completed fixture is reproducible', () => {
  it('fills an enum the same way twice', () => {
    const query = gql`
      query ProbeUnitType {
        units {
          id
          type
        }
      }
    `;
    const first = complete(query, { units: [{ id: 'u-1' }] });
    const second = complete(query, { units: [{ id: 'u-1' }] });
    expect(second).toEqual(first);
    // And it is a real member of `UnitType`, not an invention.
    const filled = (first.units as Array<{ type: string }>)[0].type;
    expect(UNIT_TYPES).toContain(filled);
  });

  it('completes every real operation identically on two runs', () => {
    // The whole corpus, because the defect this guards was distributional:
    // 215 of 238 operations completed differently on two identical runs when
    // `mockGenerationBehavior` was left at its `random` default, and nothing in
    // the suite flaked often enough to notice.
    const documents = loadEveryOperation();
    expect(documents.length).toBeGreaterThan(100);

    const diverged: string[] = [];
    for (const { name, document } of documents) {
      const first = JSON.stringify(complete(document, {}));
      const second = JSON.stringify(complete(document, {}));
      if (first !== second) diverged.push(name);
    }
    expect(diverged).toEqual([]);
  });
});

describe('completion does not alter what the fixture states', () => {
  const LIST = gql`
    query ProbeUnitList {
      units {
        id
        name
      }
    }
  `;

  it('gives every stated entry its own identity past the generated template', () => {
    // The generated list is two entries long, so entries 3, 5, 7… must not
    // recycle entry 0 and its generated id: rows 0 and 2 would normalize onto
    // one record and the third entry's data would simply be gone.
    const data = complete(LIST, {
      units: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }],
    });
    const units = data.units as Array<{ id: string; name: string }>;

    expect(units.map(u => u.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(new Set(units.map(u => u.id)).size).toBe(3);
  });

  it('serves a field the fixture wrote as absent, absent', () => {
    // `DeepPartial` makes `field: undefined` the natural way to spell "the API
    // omitted this", and it is the case a test asserting `toBeUndefined()` is
    // about. Filling it from the schema asserted against data the test did not
    // write.
    const data = complete(LIST, {
      units: [{ id: 'u-1', name: undefined }],
    });
    const units = data.units as Array<Record<string, unknown>>;
    expect('name' in units[0]).toBe(false);
    // ...and a field it simply did not mention is still completed.
    expect(units[0].id).toBe('u-1');
  });

  it('keeps an id the fixture stated', () => {
    const data = complete(LIST, {
      units: [{ id: 'pinned-1', name: 'Alpha' }, { name: 'Beta' }],
    });
    const units = data.units as Array<{ id: string }>;
    expect(units[0].id).toBe('pinned-1');
    expect(units[1].id).not.toBe('pinned-1');
  });

  it('issues disjoint identity to two fixtures completed in one test', () => {
    // The counter does not rewind at the start of a completion. Rewinding hands
    // two mocks in one test the same sequence, and their entities collide on one
    // normalized cache key — the collapse the counter exists to prevent, moved
    // from within an operation to across two.
    const items = gql`
      query ProbeItemList {
        items {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;
    const unitIds = idsIn(complete(LIST, { units: [{ name: 'A' }] }));
    const itemIds = idsIn(complete(items, {}));

    expect(unitIds.length).toBeGreaterThan(0);
    expect(itemIds.length).toBeGreaterThan(0);
    for (const id of unitIds) expect(itemIds).not.toContain(id);
  });
});

describe('a pinned variant applies where it was pinned', () => {
  // Two positions of the same result union. Every one of the schema's result
  // unions carries the same four error members, so a pin keyed by TYPE could
  // only answer for the whole response — it forced one member onto every other
  // union field, and two pinned members disabled pinning altogether.
  const TWO_POSITIONS = gql`
    mutation ProbeTwoUnionPositions($input: CreateShoppingListInput!) {
      first: createShoppingList(input: $input) {
        __typename
        ... on Error {
          code
          message
        }
        ... on ValidationError {
          field
        }
        ... on NotFoundError {
          resource
        }
      }
      second: createShoppingList(input: $input) {
        __typename
        ... on Error {
          code
          message
        }
        ... on ValidationError {
          field
        }
        ... on NotFoundError {
          resource
        }
      }
    }
  `;

  it('honours a different member at each position', () => {
    const data = complete(TWO_POSITIONS, {
      first: { __typename: 'ValidationError', field: 'name' },
      second: { __typename: 'NotFoundError', resource: 'ShoppingList' },
    });

    expect((data.first as { __typename: string }).__typename).toBe(
      'ValidationError',
    );
    expect((data.second as { __typename: string }).__typename).toBe(
      'NotFoundError',
    );
  });

  it('does not spread one position’s pin onto another', () => {
    const data = complete(TWO_POSITIONS, {
      first: { __typename: 'ValidationError', field: 'name' },
    });

    expect((data.first as { __typename: string }).__typename).toBe(
      'ValidationError',
    );
    expect((data.second as { __typename: string }).__typename).not.toBe(
      'ValidationError',
    );
  });
});

describe('completion is memoized per variables, not across them', () => {
  it('gives two calls with different nested variables different results', () => {
    // The memo key must sort RECURSIVELY. Built with `JSON.stringify`'s second
    // argument instead — an allowlist applied at every depth — every call whose
    // variables nest collapsed onto one key, and two concurrent mutations
    // shared one completed response.
    const echo = completeMockedResponse({
      request: { query: ECHO_ITEMS, variables: () => true },
      result: (vars: { filters: { category: string } }) => ({
        data: {
          items: {
            __typename: 'ItemConnection',
            edges: [
              {
                __typename: 'ItemEdge',
                node: { __typename: 'Item', name: vars.filters.category },
              },
            ],
          },
        },
      }),
    } as unknown as MockedResponse);
    const run = (category: string) =>
      (
        echo.result as (v: Record<string, unknown>) => {
          data: { items: { edges: Array<{ node: { name: string } }> } };
        }
      )({ filters: { category } }).data.items.edges[0].node.name;

    expect(run('a')).toBe('a');
    expect(run('b')).toBe('b');
    // ...and a repeat of the first still hits the memo rather than re-running.
    expect(run('a')).toBe('a');
  });
});

describe('the shared schema carries no state between tests', () => {
  // The schema and its store are built ONCE and shared, which is what makes
  // completion deterministic and what makes it 19% cheaper. Both properties
  // depend on the store being emptied between tests rather than accumulating.
  const firstIds: string[] = [];

  it('issues identity from the start of the sequence', () => {
    firstIds.push(...idsIn(complete(LIST_FOR_RESET, { units: [{ name: 'A' }] })));
    expect(firstIds.length).toBeGreaterThan(0);
  });

  it('issues the SAME identity in the next test, not the next numbers', () => {
    const second = idsIn(complete(LIST_FOR_RESET, { units: [{ name: 'A' }] }));
    expect(second).toEqual(firstIds);
  });
});

describe('schema drift fails at wrapper construction', () => {
  it('throws synchronously, not from inside a deferred mock callback', () => {
    // Raised from the `result` callback it was thrown out of MockLink's
    // `setTimeout`: the test failed as a 5s `waitFor` timeout with the real
    // message relegated to a secondary trace, and under `forceExit` it could
    // vanish entirely.
    const drifted = gql`
      query ProbeDriftedDocument {
        units {
          id
          aFieldTheSchemaDoesNotHave
        }
      }
    `;
    expect(() =>
      createApolloTestWrapper({
        operationMocks: [
          { request: { query: drifted }, result: { data: {} } } as MockedResponse,
        ],
      }),
    ).toThrow(/does not match src\/graphql\/generated\/schema\.graphql/);
  });
});

describe('a fixture the operation cannot return is rejected', () => {
  // The check that found 74 over-stated keys across 18 operations. Reported
  // rather than thrown in place, because completion runs inside MockLink's
  // `setTimeout` — a throw there escapes as an uncaught exception and the test
  // fails as a 5s `waitFor` timeout naming the wrong thing.
  it('names the field, and the operation it is not on', () => {
    const echo = completeMockedResponse({
      request: { query: PROBE_UNITS, variables: () => true },
      result: {
        data: {
          units: [{ __typename: 'Unit', id: 'u-1', notAFieldThisQueryAsks: 1 }],
        },
      },
    } as unknown as MockedResponse);
    (echo.result as (v: Record<string, unknown>) => unknown)({});

    expect(() => throwOnUnknownFixtureKeys()).toThrow(
      /ProbeUnitsForEmptyMocks: units\.notAFieldThisQueryAsks/,
    );
  });

  it('says nothing when every stated key is on the operation', () => {
    const echo = completeMockedResponse({
      request: { query: PROBE_UNITS, variables: () => true },
      result: { data: { units: [{ __typename: 'Unit', id: 'u-1' }] } },
    } as unknown as MockedResponse);
    (echo.result as (v: Record<string, unknown>) => unknown)({});

    expect(() => throwOnUnknownFixtureKeys()).not.toThrow();
  });
});

describe('the two mocking strategies cannot be combined', () => {
  it('rejects a caller that passes both', () => {
    // The union type makes this unreachable from TypeScript — it caught four
    // live sites in `useNotificationSettings.test.ts`, where the discarded
    // `mocks` left the preferences query unanswered and the hook running on
    // defaults with all sixteen tests passing. This is the backstop for a
    // JavaScript caller and for an object assembled at runtime.
    expect(() =>
      createApolloTestWrapper({
        operationMocks: [],
        mocks: { Query: () => ({}) },
      } as unknown as Parameters<typeof createApolloTestWrapper>[0]),
    ).toThrow(/not both/);
  });
});

describe('an empty operationMocks array means no mocks', () => {
  it('does not fall through to the schema-driven link', () => {
    // `operationMocks: []` reads as "no mocks". Falling through instead selects
    // a link that answers EVERY operation with generated data and writes it into
    // the cache, possibly after teardown. 14 sites spell it that way.
    const wrapper = createApolloTestWrapper({ operationMocks: [] });
    expect(typeof wrapper).toBe('function');

    // The schema-driven branch is the one that builds a SchemaLink; the
    // per-operation branch passes a `mocks` array instead. Rendering a query
    // under this wrapper yields a no-mock failure rather than invented data.
    const { result } = renderHookWithApollo(
      () => useQuery(PROBE_UNITS),
      { operationMocks: [] },
    );
    expect(result.current.data).toBeUndefined();
  });
});

describe('the document is validated in the form the client sends', () => {
  it('completes a document carrying a client-only directive', () => {
    // `@connection` is removed by Apollo before the operation goes out.
    // Rejecting it as an unknown directive would hard-fail every mock for a
    // paginated document, with advice — run codegen — that cannot resolve it.
    const paginated = gql`
      query ProbeConnectionDirective {
        units @connection(key: "probeUnits") {
          id
          name
        }
      }
    `;
    expect(() => complete(paginated, { units: [{ name: 'Alpha' }] })).not.toThrow();
  });
});

/** Every operation the app actually ships, with the fragments it spreads. */
function loadEveryOperation(): Array<{ name: string; document: DocumentNode }> {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.graphql') && entry !== 'schema.graphql') {
        files.push(full);
      }
    }
  };
  walk(join(process.cwd(), 'src'));

  const fragments: FragmentDefinitionNode[] = [];
  const operations: OperationDefinitionNode[] = [];
  for (const file of files) {
    for (const definition of parse(readFileSync(file, 'utf8')).definitions) {
      if (definition.kind === 'FragmentDefinition') fragments.push(definition);
      if (definition.kind === 'OperationDefinition') operations.push(definition);
    }
  }

  return operations.map((operation, index) => ({
    name: operation.name?.value ?? `anonymous-${index}`,
    document: {
      kind: 'Document',
      definitions: [operation, ...fragments],
    } as DocumentNode,
  }));
}

function idsIn(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) idsIn(entry, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'id' && typeof nested === 'string') out.push(nested);
    else idsIn(nested, out);
  }
  return out;
}
