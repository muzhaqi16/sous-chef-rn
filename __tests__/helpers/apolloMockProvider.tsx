import React, { type ReactNode } from 'react';
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react-native';
import { InMemoryCache } from '@apollo/client';
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
import type { DefaultOptions } from '@apollo/client';

const TEST_DEFAULT_OPTIONS: DefaultOptions = {
  query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
  mutate: { errorPolicy: 'all' },
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
  },
};

export function createApolloTestWrapper(options: ApolloTestOptions = {}) {
  const { operationMocks, mocks, resolvers } = options;

  if (operationMocks && operationMocks.length > 0) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MockedProvider
          mocks={[...operationMocks]}
          showWarnings={false}
          defaultOptions={TEST_DEFAULT_OPTIONS}
        >
          {children as React.ReactElement}
        </MockedProvider>
      );
    };
  }

  const link = buildSchemaLink({ mocks, resolvers });
  const cache = new InMemoryCache();
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
 * Backwards-compat alias: pass an array of `MockedResponse` entries.
 *
 * @deprecated Prefer `createApolloTestWrapper({ operationMocks })` so the
 *   call site documents which strategy is in use.
 */
export function createApolloWrapper(operationMocks: MockedResponse[] = []) {
  return createApolloTestWrapper({ operationMocks });
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
  const { mocks, resolvers, operationMocks, ...rest } = options as ApolloTestOptions &
    Omit<RenderHookOptions<TProps>, 'wrapper'>;
  return renderHook(callback, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks }),
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
  const { mocks, resolvers, operationMocks, ...rest } = options;
  return render(ui, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks }),
    ...rest,
  });
}
