import React, { type ReactNode } from 'react';
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from '@testing-library/react-native';
import { gql, InMemoryCache, type OperationVariables } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
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
import type { IResolvers } from '@graphql-tools/utils';
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
// Unique per execution, identical between runs. A CONSTANT id would be
// deterministic but collapse every unpinned entity of a type onto the same
// cache key (`Type:mock-id`), so a three-item list would normalize to one
// record; graphql-tools' own default is a random UUID, which is unique but
// makes a failure impossible to reproduce. A counter reset at the start of each
// completion is both.
let mockIdCounter = 0;
function nextMockId() {
  mockIdCounter += 1;
  return `mock-id-${mockIdCounter}`;
}

const DEFAULT_SCALAR_MOCKS: IMocks = {
  ID: () => nextMockId(),
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
  resolvers?: (store: IMockStore) => Partial<IResolvers>;
  /**
   * Per-operation request/response pairs. These take priority over the
   * schema-driven layer and behave exactly like a vanilla `MockedProvider`
   * `mocks={[…]}` array.
   */
  operationMocks?: ReadonlyArray<MockedResponse>;
  /**
   * Serve `operationMocks` exactly as written (see `recordMock`'s `partial`).
   * Only for a test whose subject is incomplete data.
   */
  partialMocks?: boolean;
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
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';

// The app's own defaults, not a near-copy. This was a hand-maintained
// duplicate that had already drifted from `client.ts` (no `returnPartialData`),
// which meant tests exercised a client that behaved differently from the app.
const TEST_DEFAULT_OPTIONS = APOLLO_DEFAULT_OPTIONS;

/**
 * Mocks marked deliberately incomplete. Held in a WeakSet rather than as a
 * property so nothing is attached to the object Apollo receives.
 */
const partiallyMockedResponses = new WeakSet<object>();

function markPartial(mock: object): void {
  partiallyMockedResponses.add(mock);
}

function isPartial(mock: MockedResponse): boolean {
  return partiallyMockedResponses.has(mock);
}

/**
 * Serve a per-operation mock's `result` completed from the real SDL. `error`
 * mocks, mocks with no result, and mocks marked partial pass through untouched.
 */
function completeMockedResponse(mock: MockedResponse): MockedResponse {
  if (isPartial(mock)) return mock;
  if (!('result' in mock) || mock.result === undefined) return mock;
  const { result } = mock;
  return {
    ...mock,
    result: (vars: Record<string, unknown>) => {
      const resolved = typeof result === 'function' ? result(vars) : result;
      if (!resolved || !('data' in resolved) || resolved.data === undefined) {
        return resolved;
      }
      return {
        ...resolved,
        data: completeFromSchema(mock.request.query, vars, resolved.data),
      };
    },
  } as MockedResponse;
}

export function createApolloTestWrapper(options: ApolloTestOptions = {}) {
  const {
    operationMocks,
    mocks,
    resolvers,
    partialMocks,
    cache: providedCache,
  } = options;
  // The PRODUCTION cache, not a bare one. `makeCache()` carries 16
  // `typePolicies` — 15 merge functions, 6 read functions, 9 merge directives
  // and the generated `possibleTypes` — and those decide what a write leaves
  // behind and what a read returns. A bare `InMemoryCache` was the default here for a long time,
  // so 143 files tested the app against an engine it does not run: rules that
  // were not loaded could not be tested, and one screen test learned the wrong
  // behaviour outright (no `possibleTypes` meant `... on Error` did not match,
  // `code` was dropped, and the test asserted generic copy a user never sees).
  //
  // A suite that genuinely wants a reduced cache passes its own through
  // `cache` — the escape hatch is the parameter, not the default.
  // Guarded by `__tests__/apollo/testCacheIsTheProductionCache.test.ts`.
  const cache = providedCache ?? makeCache();

  if (operationMocks && operationMocks.length > 0) {
    // Completion is applied HERE rather than only in `recordMock`, so a plain
    // `{ request, result }` literal gets it too — the literal form is the one
    // most likely to be written by hand and to omit a field.
    // A test that opted into partial data will write incomplete records by
    // definition. Tell the missing-field guard in `__tests__/setup/globals.js`
    // so it does not report the very thing the test asked for; anything that
    // did NOT opt in is still held to completeness.
    if (partialMocks || operationMocks.some(isPartial)) {
      (globalThis as { __apolloPartialMocksInUse?: boolean })
        .__apolloPartialMocksInUse = true;
    }
    const completed = partialMocks
      ? [...operationMocks]
      : operationMocks.map(completeMockedResponse);
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MockedProvider
          mocks={completed}
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
  const { mocks, resolvers, operationMocks, partialMocks, cache, ...rest } = options as ApolloTestOptions &
    Omit<RenderHookOptions<TProps>, 'wrapper'>;
  return renderHook(callback, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks, partialMocks, cache }),
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
  const { mocks, resolvers, operationMocks, partialMocks, cache, ...rest } = options;
  return render(ui, {
    wrapper: createApolloTestWrapper({ mocks, resolvers, operationMocks, partialMocks, cache }),
    ...rest,
  });
}

import type { DocumentNode, GraphQLSchema } from 'graphql';
import { typeFromAST } from 'graphql';
import {
  executeSync,
  isAbstractType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  validate,
  type GraphQLInputType,
  type OperationDefinitionNode,
} from 'graphql';
import type { FragmentType, Unmasked } from '@apollo/client/masking';
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
  TDoc extends TypedDocumentNode,
>(data: Record<string, unknown> & { __typename: string; id: string }): FragmentType<TDoc> {
  return data as FragmentType<TDoc>;
}

export interface RecordedMock {
  /**
   * MockedResponse to feed into `operationMocks`. Deliberately the loose form:
   * `data` is a `DeepPartial` that schema completion fills in before it is
   * served, so a `MockedResponse<TData>` here would be claiming a completeness
   * the object does not yet have — and `operationMocks` takes the loose form.
   */
  mock: MockedResponse;
  /** Variables observed for each invocation, in order. */
  fired: Array<Record<string, unknown>>;
}

/**
 * Every field optional, all the way down. The mock only has to state what the
 * test asserts on — schema completion supplies the rest — so requiring the full
 * `Unmasked<TData>` would be asking for payloads nobody needs to write. What
 * this DOES enforce is that whatever the test does write is real: a field name
 * that is not on the type, a `__typename` outside its union, an `ErrorCode`
 * that does not exist.
 *
 * `| null` on every property is deliberate and is NOT laxness about
 * nullability. The client runs `errorPolicy: 'all'` globally, so a field error
 * arrives as `null` in that field ALONGSIDE `errors` — even where the schema
 * says non-null. Tests for that path are testing something real, and a type
 * that forbade it would be describing a response the client can genuinely
 * receive as impossible.
 */
type DeepPartial<T> = T extends (infer U)[]
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> | null }
    : T;

export interface RecordMockOptions<TData = Record<string, unknown>> {
  /** Static response data, OR a function of variables → data. */
  data?:
    | DeepPartial<Unmasked<TData>>
    | ((vars: Record<string, unknown>) => DeepPartial<Unmasked<TData>>);
  /** Simulate a network error instead of returning data. */
  error?: Error;
  /** Delay (ms) before resolving — useful for in-flight assertions. */
  delay?: number;
  /** Cap on how many times this mock can match. Default: unbounded. */
  maxUsageCount?: number;
  /**
   * Serve `data` exactly as written, without completing it from the SDL.
   * Only for a test whose SUBJECT is incomplete data — one asserting that a
   * field the API omitted stays undefined, or that a partial cached fragment
   * is dropped. Completion would erase the very thing under test. Anywhere
   * else an incomplete payload is a defect, so leave this off.
   */
  partial?: boolean;
}

// ---------------------------------------------------------------------------
// Schema completion for per-operation mocks
// ---------------------------------------------------------------------------
// A hand-written `data` payload states what the test cares about and silently
// omits the rest. Apollo then writes an INCOMPLETE record: one missing field
// makes the whole cache read incomplete and `useQuery` returns nothing, so the
// omission changes behaviour rather than merely adding console noise — and the
// warning that would say so is swallowed (see `__tests__/setup/globals.js`).
//
// So the payload is completed from the REAL SDL before it is served: execute
// the operation against the mocked schema, then merge the caller's data over
// the result. The test keeps stating only what it asserts on, and every other
// selected field is schema-shaped and present. Execution also validates the
// variables, which `variables: () => true` never did.
//
// If execution cannot produce a result (a local-only `@client` field, variables
// that do not satisfy the schema), the caller's data is served verbatim — the
// completion is an improvement, never a new way to fail.

/** Every `__typename` the caller pinned, at any depth. */
function collectTypenames(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectTypenames(entry, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.__typename === 'string') out.add(record.__typename);
  for (const nested of Object.values(record)) collectTypenames(nested, out);
}

/**
 * Resolve each union/interface to the member the caller pinned. Without this a
 * mock for a rejection path gets an arbitrary member of the result union and
 * merging produces an object carrying both shapes at once.
 */
function abstractTypeMocks(schema: GraphQLSchema, pinned: Set<string>): IMocks {
  const mocks: IMocks = {};
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isAbstractType(type)) continue;
    const chosen = schema
      .getPossibleTypes(type)
      .map(possible => possible.name)
      .filter(name => pinned.has(name));
    if (chosen.length === 1) mocks[type.name] = () => ({ __typename: chosen[0] });
  }
  return mocks;
}

/** Caller data wins; anything it omits keeps the schema-generated value. */
function mergeOverSchema(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (override === null || typeof override !== 'object') return override;
  if (Array.isArray(override)) {
    const template = Array.isArray(base) ? base : [];
    return override.map((entry, index) =>
      mergeOverSchema(template[index] ?? template[0], entry),
    );
  }
  const merged: Record<string, unknown> = {
    ...((base && typeof base === 'object' && !Array.isArray(base)
      ? base
      : {}) as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    merged[key] = mergeOverSchema(merged[key], value);
  }
  return merged;
}

// The client adds `__typename` to every selection set before it sends an
// operation; the raw generated document has it only where a `.graphql` file
// asked. Executing the untransformed document would omit the key field the
// cache normalizes by, so the transform runs here too.
let cachedTransformCache: InMemoryCache | null = null;
function transformLikeTheClient(query: DocumentNode): DocumentNode {
  cachedTransformCache = cachedTransformCache ?? makeCache();
  return cachedTransformCache.transformDocument(query);
}

// Two things can go wrong, and they mean opposite things.
//
// The DOCUMENT not matching the schema is drift: the operation selects
// something the API no longer offers, so every mock feeding it is describing a
// response that can never arrive. That is thrown, loudly — falling back would
// restore exactly the silence this whole mechanism exists to remove. (`npm run
// lint` catches it earlier via `@graphql-eslint/fields-on-correct-type`; this
// is the backstop for a document that never reaches that rule.)
//
// The VARIABLES not satisfying the schema is the test's own business —
// `variables: () => true` is the established idiom here and plenty of suites
// pass a partial input on purpose. Those fall back to the caller's data
// unchanged, exactly as before this helper existed.
const schemaCheckedDocuments = new WeakSet<DocumentNode>();

function assertDocumentMatchesSchema(query: DocumentNode, document: DocumentNode) {
  if (schemaCheckedDocuments.has(query)) return;
  const errors = validate(getBaseSchema(), document);
  if (errors.length > 0) {
    throw new Error(
      'Mocked operation does not match src/graphql/generated/schema.graphql:\n' +
        errors.map(error => `  - ${error.message}`).join('\n') +
        '\n\nThe .graphql document selects something the schema no longer ' +
        'offers. Run `npm run codegen` and update the document — ' +
        '`npm run lint` checks the same thing.',
    );
  }
  schemaCheckedDocuments.add(query);
}

/**
 * A schema-valid value for one variable.
 *
 * Completion executes against a MOCKED schema, which ignores arguments
 * entirely — so the variables only have to satisfy validation, never carry
 * meaning. Only NON-NULL variables need a value; anything nullable may be
 * omitted.
 */
function placeholderForInput(type: GraphQLInputType): unknown {
  if (!isNonNullType(type)) return null;
  const inner = type.ofType;
  if (isListType(inner)) return [];
  if (isEnumType(inner)) return inner.getValues()[0]?.value ?? null;
  if (isInputObjectType(inner)) {
    const value: Record<string, unknown> = {};
    for (const field of Object.values(inner.getFields())) {
      if (isNonNullType(field.type) && field.defaultValue === undefined) {
        value[field.name] = placeholderForInput(field.type);
      }
    }
    return value;
  }
  const scalar = DEFAULT_SCALAR_MOCKS[inner.name];
  if (typeof scalar === 'function') return (scalar as () => unknown)();
  return inner.name === 'Int' || inner.name === 'Float' ? 1 : 'mock-string';
}

/**
 * Variables that satisfy the operation's own definitions, regardless of what
 * the hook under test happened to pass.
 *
 * Executing with the CALLER's variables sounds more faithful but is not: a
 * mocked schema ignores arguments, so the only thing the caller's variables can
 * do is fail validation — and a validation failure means completion silently
 * serves the hand-written payload, which is exactly the incomplete write this
 * mechanism exists to prevent. `usePantryItemMutations` was doing that: every
 * mock served three fields of a twenty-nine-field entity because the operation
 * takes `$input: DeletePantryItemInput!` and validation rejected the call.
 */
function schemaValidVariables(
  document: DocumentNode,
  schema: GraphQLSchema,
  caller: Record<string, unknown>,
): Record<string, unknown> {
  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === 'OperationDefinition',
  );
  const variables: Record<string, unknown> = {};
  for (const definition of operation?.variableDefinitions ?? []) {
    const name = definition.variable.name.value;
    const type = typeFromAST(schema, definition.type);
    if (type) variables[name] = placeholderForInput(type as GraphQLInputType);
  }
  // The caller's values win where they exist, so a mock whose `data` is a
  // function of variables still sees what the hook actually sent.
  return { ...variables, ...caller };
}

function completeFromSchema(
  query: DocumentNode,
  variables: Record<string, unknown>,
  overrideData: unknown,
): unknown {
  const document = transformLikeTheClient(query);
  assertDocumentMatchesSchema(query, document);

  const pinned = new Set<string>();
  collectTypenames(overrideData, pinned);
  const schema = addMocksToSchema({
    schema: getBaseSchema(),
    mocks: {
      ...DEFAULT_SCALAR_MOCKS,
      ...abstractTypeMocks(getBaseSchema(), pinned),
    },
  });

  // Caller's variables first so a variables-dependent mock sees them; then the
  // schema-valid set alone, because a caller value that fails validation must
  // not cost the whole completion.
  for (const variableValues of [
    schemaValidVariables(document, getBaseSchema(), variables),
    schemaValidVariables(document, getBaseSchema(), {}),
  ]) {
    // Reset so one operation's completion is byte-identical every run,
    // whatever ran before it.
    mockIdCounter = 0;
    let executed;
    try {
      executed = executeSync({ schema, document, variableValues });
    } catch {
      executed = undefined;
    }
    if (executed?.data) return mergeOverSchema(executed.data, overrideData);
  }
  return overrideData;
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
export function recordMock<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  query: TypedDocumentNode<TData, TVariables>,
  options: RecordMockOptions<TData> = {},
): RecordedMock {
  const fired: Array<Record<string, unknown>> = [];
  const { data, error, delay, maxUsageCount, partial } = options;

  // Completion happens per invocation because it needs the variables the
  // operation actually fired with, so `result` is a function even when the
  // caller passed a static object.
  // Completion is NOT applied here — `createApolloTestWrapper` does it for
  // every mock it serves, so there is one place that decides. `partial` only
  // records the caller's intent for that single place to honour.
  const result = data
    ? typeof data === 'function'
      ? (vars: Record<string, unknown>) => ({
          data: (data as (v: Record<string, unknown>) => Record<string, unknown>)(
            vars,
          ),
        })
      : { data }
    : undefined;

  const mock: MockedResponse = {
    request: {
      query,
      variables: vars => {
        fired.push(vars);
        return true;
      },
    },
    maxUsageCount: maxUsageCount ?? Number.POSITIVE_INFINITY,
    ...(delay !== undefined ? { delay } : {}),
    ...(error ? { error } : { result: result as MockedResponse['result'] }),
  };

  if (partial) markPartial(mock);
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
  // Production cache, for the reason on the default above — `seedCache` is the
  // other route to the same substitution and feeds 32 files.
  const cache = makeCache();
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
