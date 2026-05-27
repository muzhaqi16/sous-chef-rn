import React, { type ReactNode } from 'react';
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react-native';
import { gql, InMemoryCache } from '@apollo/client';
import { SchemaLink } from '@apollo/client/link/schema';
import { MockedProvider } from '@apollo/client/testing/react';
import { MockLink } from '@apollo/client/testing';
// Re-export the non-deprecated mocked-response type so consumers can write
// `MockedResponse[]` without reaching into the `MockLink` namespace. The
// flat `MockedResponse` import from `@apollo/client/testing` is deprecated
// in Apollo Client 4.x.
export type MockedResponse<
  TData = Record<string, unknown>,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
> = MockLink.MockedResponse<TData, TVariables>;
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  addMocksToSchema,
  type IMocks,
  type IMockStore,
} from '@graphql-tools/mock';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Centralized Apollo testing helper. Every test mounts under Apollo's
 * `MockedProvider` from `@apollo/client/testing/react`.
 *
 * Two complementary mocking strategies:
 *
 * 1. **Schema-driven auto-mocks (default).** Builds an executable schema from
 *    `src/graphql/generated/schema.graphql`, runs it through
 *    `addMocksToSchema` (`@graphql-tools/mock` — referenced by Apollo's
 *    testing docs), and feeds the result into `MockedProvider` via its
 *    `link` prop using `SchemaLink`. Any query the hook fires returns
 *    schema-shaped data automatically; tests only override the fields they
 *    care about via the `mocks` resolver map.
 *
 * 2. **Per-operation mocks.** For tests that need exact responses (e.g. to
 *    assert a mutation was called with specific variables, or to simulate an
 *    error path), pass `operationMocks` — these are forwarded to
 *    `MockedProvider`'s `mocks` prop and matched on `{ query, variables }`.
 *
 * Use one or the other depending on what the test needs to assert.
 */

const SCHEMA_PATH = path.resolve(
  __dirname,
  '../../src/graphql/generated/schema.graphql',
);

let cachedBaseSchema: ReturnType<typeof makeExecutableSchema> | null = null;
function getBaseSchema() {
  if (cachedBaseSchema) return cachedBaseSchema;
  const sdl = fs.readFileSync(SCHEMA_PATH, 'utf8');
  cachedBaseSchema = makeExecutableSchema({ typeDefs: sdl });
  return cachedBaseSchema;
}

// Sensible scalar defaults — the schema mock library doesn't know about
// custom scalars unless we tell it.
const DEFAULT_SCALAR_MOCKS: IMocks = {
  ID: () => 'mock-id',
  String: () => 'mock-string',
  Int: () => 1,
  Float: () => 1,
  Boolean: () => true,
  DateTime: () => '2025-01-01T00:00:00.000Z',
  Date: () => '2025-01-01',
  JSON: () => ({}),
  BigInt: () => '1',
  IPv4: () => '127.0.0.1',
  FlexibleQuantity: () => '1',
  Upload: () => ({ uri: 'file://mock', type: 'image/png', name: 'mock.png' }),
};

export interface ApolloTestOptions {
  /**
   * Type/field resolver map fed to `addMocksToSchema`. Anything you don't
   * specify is filled in by the schema with sensible scalar defaults.
   *
   * @example
   * mocks: { Query: () => ({ me: { id: 'u1', email: 'a@b.com' } }) }
   */
  mocks?: IMocks;
  /**
   * Custom resolvers fed to `addMocksToSchema`. Use when you need access to
   * the mock store (e.g. to wire mutation responses back into reads).
   */
  resolvers?: (store: IMockStore) => Record<string, any>;
  /**
   * Per-operation request/response pairs. These take priority over the
   * schema-driven layer and behave exactly like a vanilla `MockedProvider`
   * `mocks={[…]}` array.
   */
  operationMocks?: ReadonlyArray<MockedResponse>;
  /**
   * Pre-seeded `InMemoryCache` (typically built via `seedCache(entries)`).
   * Use when the hook reads via `useApolloClient().cache.readFragment(...)`
   * — without a seed, those reads return `null` and the hook bails out.
   */
  cache?: InMemoryCache;
}

function buildSchemaLink(options: Pick<ApolloTestOptions, 'mocks' | 'resolvers'>) {
  const baseSchema = getBaseSchema();
  const mockedSchema = addMocksToSchema({
    schema: baseSchema,
    mocks: { ...DEFAULT_SCALAR_MOCKS, ...options.mocks },
    resolvers: options.resolvers,
  });
  return new SchemaLink({ schema: mockedSchema });
}

/**
 * Build a wrapper component that mounts children under `MockedProvider`.
 *
 * - With only `mocks` / `resolvers`: schema-driven auto-mocks (everything
 *   resolves to schema-default data unless you override).
 * - With `operationMocks`: per-operation `MockedProvider` mocks.
 * - Don't combine both at once — pick the strategy your test needs.
 */
import type { ApolloClient } from '@apollo/client';

const TEST_DEFAULT_OPTIONS: ApolloClient.DefaultOptions = {
  query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
  mutate: { errorPolicy: 'all' },
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  },
};

export function createApolloTestWrapper(options: ApolloTestOptions = {}) {
  const { operationMocks, mocks, resolvers, cache: providedCache } = options;
  const cache = providedCache ?? new InMemoryCache();

  if (operationMocks && operationMocks.length > 0) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MockedProvider
          mocks={[...operationMocks]}
          cache={cache}
          showWarnings={false}
          defaultOptions={TEST_DEFAULT_OPTIONS}
        >
          {children as React.ReactElement}
        </MockedProvider>
      );
    };
  }

  const link = buildSchemaLink({ mocks, resolvers });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider
        link={link}
        cache={cache}
        showWarnings={false}
        defaultOptions={TEST_DEFAULT_OPTIONS}
      >
        {children as React.ReactElement}
      </MockedProvider>
    );
  };
}

/**
 * `renderHook` that auto-wraps with the Apollo test provider.
 *
 * @example
 * const { result } = renderHookWithApollo(
 *   () => useGetMe(),
 *   { mocks: { Query: () => ({ me: { id: 'u1' } }) } },
 * );
 */
export function renderHookWithApollo<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options: ApolloTestOptions & Omit<RenderHookOptions<TProps>, 'wrapper'> = {},
) {
  const { mocks, resolvers, operationMocks, cache, ...rest } = options as ApolloTestOptions &
    Omit<RenderHookOptions<TProps>, 'wrapper'>;
  return renderHook(callback, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks, cache }),
    ...rest,
  });
}

/**
 * `render` that auto-wraps with the Apollo test provider.
 */
export function renderWithApollo(
  ui: React.ReactElement,
  options: ApolloTestOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { mocks, resolvers, operationMocks, cache, ...rest } = options;
  return render(ui, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks, cache }),
    ...rest,
  });
}

import type { DocumentNode } from 'graphql';
import type { FragmentType } from '@apollo/client/masking';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

/**
 * Brand a plain data fixture as `FragmentType<typeof SomeFragmentDoc>` so it
 * can be passed to component props that expect an opaque fragment ref.
 *
 * At runtime `useFragment` only reads `__typename` + key fields from the ref
 * (via `cache.identify`), so any object with those fields works. This helper
 * exists purely to satisfy the type system without `as never` or
 * `as unknown as X`.
 *
 * @example
 *   const item = buildItem();
 *   <PantryItemCard pantryItemRef={toFragmentRef<typeof PantryItemCard_PantryItemFragmentDoc>(item)} />
 */
export function toFragmentRef<
  TDoc extends TypedDocumentNode<any, any>,
>(data: Record<string, unknown> & { __typename: string; id: string }): FragmentType<TDoc> {
  return data as FragmentType<TDoc>;
}

export interface RecordedMock<TData = Record<string, unknown>> {
  /** MockedResponse to feed into `operationMocks`. */
  mock: MockedResponse<TData>;
  /** Variables observed for each invocation, in order. */
  fired: Array<Record<string, unknown>>;
}

export interface RecordMockOptions<TData = Record<string, unknown>> {
  /** Static response data, OR a function of variables → data. */
  data?: TData | ((vars: Record<string, unknown>) => TData);
  /** Simulate a network error instead of returning data. */
  error?: Error;
  /** Delay (ms) before resolving — useful for in-flight assertions. */
  delay?: number;
  /** Cap on how many times this mock can match. Default: unbounded. */
  maxUsageCount?: number;
}

/**
 * Build a `MockedResponse` that records every invocation's variables. Use to
 * replace the legacy `mockMutation.toHaveBeenCalledWith({ variables: ... })`
 * pattern: pass `mock` to `operationMocks`, then assert on `fired`.
 *
 * @example
 *   const update = recordMock(UpdateShoppingListItemDocument, {
 *     data: { updateShoppingListItem: { __typename: 'Payload', success: true } },
 *   });
 *
 *   const { result } = renderHookWithApollo(
 *     () => useUpdateShoppingItem({ listId: 'l1', refetch }),
 *     { operationMocks: [update.mock] },
 *   );
 *
 *   await act(async () => {
 *     await result.current.updateItem('item-1', { quantity: 5 });
 *   });
 *
 *   expect(update.fired).toContainEqual({ id: 'item-1', input: { quantity: 5 } });
 */
export function recordMock<TData = Record<string, unknown>>(
  query: DocumentNode,
  options: RecordMockOptions<TData> = {},
): RecordedMock<TData> {
  const fired: Array<Record<string, unknown>> = [];
  const { data, error, delay, maxUsageCount } = options;

  const result = data
    ? typeof data === 'function'
      ? (vars: Record<string, unknown>) => ({
          data: (data as (v: Record<string, unknown>) => TData)(vars),
        })
      : { data }
    : undefined;

  const mock: MockedResponse<TData> = {
    request: {
      query,
      variables: vars => {
        fired.push(vars);
        return true;
      },
    },
    maxUsageCount: maxUsageCount ?? Number.POSITIVE_INFINITY,
    ...(delay !== undefined ? { delay } : {}),
    ...(error
      ? { error }
      : { result: result as MockedResponse<TData>['result'] }),
  };

  return { fired, mock };
}

/**
 * Pre-write entities into a fresh `InMemoryCache` and return the cache. Use
 * with `createApolloTestWrapper({ cache })` (or pass to MockedProvider's
 * `cache` prop directly) to support hooks that call
 * `useApolloClient().cache.readFragment(...)`.
 *
 * Each entry must include `__typename` + `id` so the cache can normalize it.
 *
 * @example
 *   const cache = seedCache([
 *     { __typename: 'ShoppingListItem', id: 'item-1', purchaseInfo: { __typename: 'ShoppingListItemPurchaseInfo', isPurchased: false }, version: 1 },
 *   ]);
 */
export function seedCache(
  entries: Array<Record<string, unknown> & { __typename: string; id: string }>,
): InMemoryCache {
  const cache = new InMemoryCache();
  for (const entry of entries) {
    const identified = cache.identify(entry as Parameters<InMemoryCache['identify']>[0]);
    cache.writeFragment({
      id: identified ?? `${entry.__typename}:${entry.id}`,
      fragment: buildFullFragment(entry),
      data: entry,
    });
  }
  return cache;
}

// Build a fragment selecting every top-level scalar + nested-object key on
// the given entry. Sufficient for tests that just need readFragment to find
// the entity — production fragment selections happen via the codegen'd docs.
function buildFullFragment(
  entry: Record<string, unknown> & { __typename: string },
): DocumentNode {
  const fields = Object.keys(entry).filter(k => k !== '__typename');
  const selectionSet = fields
    .map(f => {
      const value = entry[f];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        '__typename' in value
      ) {
        const nested = Object.keys(value).filter(k => k !== '__typename');
        return `${f} { __typename ${nested.join(' ')} }`;
      }
      return f;
    })
    .join(' ');
  return gql([
    `fragment Test_${entry.__typename}_${String(entry.id).replace(/[^a-zA-Z0-9]/g, '_')} on ${entry.__typename} { __typename ${selectionSet} }`,
  ] as unknown as TemplateStringsArray);
}
