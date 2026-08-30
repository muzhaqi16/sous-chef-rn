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
import {
  addMocksToSchema,
  createMockStore,
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

// `buildASTSchema` rather than `makeExecutableSchema`: 4.6x cheaper on the
// 432KB codegen'd SDL, and its extra work is redundant here. The SDL is
// GENERATED — `npm run codegen` writes it and `npm run lint` already validates
// every operation against it — so re-validating it per Jest worker bought
// nothing and cost 103.6ms a file, newly imposed on the 109 files that use only
// `operationMocks` and never touched a schema before.
let cachedBaseSchema: GraphQLSchema | null = null;
function getBaseSchema(): GraphQLSchema {
  if (cachedBaseSchema) return cachedBaseSchema;
  const sdl = fs.readFileSync(SCHEMA_PATH, 'utf8');
  cachedBaseSchema = buildASTSchema(parse(sdl), { assumeValidSDL: true });
  return cachedBaseSchema;
}

// Sensible scalar defaults — the schema mock library doesn't know about
// custom scalars unless we tell it.
// Unique within a test, identical between runs. A CONSTANT id would be
// deterministic but collapse every unpinned entity of a type onto the same
// cache key (`Type:mock-id`), so a three-item list would normalize to one
// record; graphql-tools' own default is a random UUID, which is unique but
// makes a failure impossible to reproduce.
//
// The counter is MODULE scope and monotonic. Resetting it per completion made
// ids unique only within one payload, so two mocks completed in the same test
// were issued the same sequence and their entities collided on one normalized
// key — the very collapse this counter exists to prevent, moved from within an
// operation to across two. Reproducibility comes from `resetMockedSchema()`
// instead, which the global `beforeEach` calls: every test starts from the same
// point with an empty store.
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

interface SharedApolloTestOptions {
  /**
   * Pre-seeded `InMemoryCache` (typically built via `seedCache(entries)`).
   * Use when the hook reads via `useApolloClient().cache.readFragment(...)`
   * — without a seed, those reads return `null` and the hook bails out.
   */
  cache?: InMemoryCache;
}

/** Per-operation request/response pairs, matched on `{ query, variables }`. */
interface OperationMockOptions extends SharedApolloTestOptions {
  operationMocks: ReadonlyArray<MockedResponse>;
  mocks?: never;
  resolvers?: never;
}

/** Schema-driven auto-mocks: everything resolves to schema-shaped data. */
interface SchemaMockOptions extends SharedApolloTestOptions {
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
  operationMocks?: never;
}

/**
 * The two mocking strategies are mutually exclusive BY TYPE, because combining
 * them silently discarded one: `operationMocks` won and `mocks`/`resolvers`
 * were dropped, `showWarnings={false}` hid the unanswered operation, and
 * `errorPolicy: 'all'` routed the failure into an `error` field no test reads.
 * A suite could pass with its hook running on defaults and nothing said so.
 */
export type ApolloTestOptions = OperationMockOptions | SchemaMockOptions;

/** The same options after the union has been narrowed away for destructuring. */
interface ResolvedApolloTestOptions extends SharedApolloTestOptions {
  operationMocks?: ReadonlyArray<MockedResponse>;
  mocks?: IMocks;
  resolvers?: (store: IMockStore) => Partial<IResolvers>;
}

/**
 * The mocked schema every default path shares.
 *
 * Built ONCE. Rebuilding it per served response cost 43.2ms a call — 19% of a
 * 50-file run — and bought nothing: the schema does not vary with the test.
 * What DOES vary is the store's contents, and `resetMockedSchema()` clears
 * those between tests, so sharing the schema costs no isolation.
 *
 * `mockGenerationBehavior: 'deterministic'` is what makes a completion
 * reproducible. Without it `takeOneOf` picks an enum member and an abstract
 * type's concrete member at random (`@graphql-tools/mock` utils.js), and 215 of
 * the schema's 238 operations completed differently on two identical runs — an
 * intermittent failure at a rate nobody measures. Deterministic takes the first
 * possible value, always.
 */
let sharedMockStore: IMockStore | null = null;
let sharedMockedSchema: GraphQLSchema | null = null;

function getMockedSchema(): GraphQLSchema {
  if (sharedMockedSchema) return sharedMockedSchema;
  const baseSchema = getBaseSchema();
  sharedMockStore = createMockStore({
    schema: baseSchema,
    mocks: DEFAULT_SCALAR_MOCKS,
    mockGenerationBehavior: 'deterministic',
  });
  const schema = addMocksToSchema({
    schema: baseSchema,
    store: sharedMockStore,
  });
  installAbstractTypePinning(schema);
  sharedMockedSchema = schema;
  return schema;
}

/**
 * Empty the shared store and rewind issued identity. Called by the global
 * `beforeEach` in `__tests__/setup/globals.js`, so a test's completions are the
 * same whether it runs alone or after a hundred others.
 */
export function resetMockedSchema(): void {
  sharedMockStore?.reset();
  mockIdCounter = 0;
}

// Registered from the helper rather than the global setup so only the files
// that actually use it pay for loading it — `makeCache` and the SDL are not
// cheap, and 500 suites never touch either.
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    resetMockedSchema();
    unknownFixtureKeys.length = 0;
    // After the global setup's `beforeEach`, which installs an empty set: a
    // file that never imports this helper keeps that empty one, and a file that
    // does keeps its own — including anything registered at module scope.
    publishPartialFieldExemptions();
  });
  afterEach(throwOnUnknownFixtureKeys);
}

function buildSchemaLink(options: Pick<ApolloTestOptions, 'mocks' | 'resolvers'>) {
  // A caller-supplied `mocks` or `resolvers` map changes what the schema
  // generates, and `resolvers` can WRITE to the store — so those get their own
  // instance. 191 of 204 wrapper builds pass neither and share the one above.
  if (!options.mocks && !options.resolvers) {
    return new SchemaLink({ schema: getMockedSchema() });
  }
  const mockedSchema = addMocksToSchema({
    schema: getBaseSchema(),
    mocks: { ...DEFAULT_SCALAR_MOCKS, ...options.mocks },
    mockGenerationBehavior: 'deterministic',
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

/** `Type.field` pairs a deliberately-partial mock leaves the cache without. */
type FieldExemptions = Set<string>;

/**
 * Tell the missing-field guard exactly which fields this mock omits.
 *
 * The previous opt-out was a whole-test boolean that made
 * `__tests__/setup/globals.js` discard EVERY collected diagnostic — one
 * deliberately-partial mock switched the guard off for every other mock, every
 * `writeFragment` and every subscription write in that test. Measured across
 * the suite, two tests opting out for one field each were silencing 27
 * diagnostics spread over six types.
 *
 * The pairs are derived by completing the mock and diffing: whatever the
 * operation selects that the fixture does not state is precisely what the write
 * will be missing, and nothing else is excused.
 */
function registerPartialFieldExemptions(mock: MockedResponse): void {
  if (!('result' in mock) || mock.result === undefined) return;
  let stated: unknown;
  try {
    const resolved =
      typeof mock.result === 'function' ? mock.result({}) : mock.result;
    if (!resolved || !('data' in resolved)) return;
    stated = resolved.data;
  } catch {
    return;
  }
  if (stated === undefined || stated === null) return;

  let full: unknown;
  try {
    full = completeFromSchema(mock.request.query, {}, stated);
  } catch {
    return;
  }

  collectOmittedFields(full, stated, partialFieldExemptions);
  publishPartialFieldExemptions();
}

/**
 * Owned HERE, not on `globalThis`, and re-published every `beforeEach`.
 *
 * A wrapper hoisted to module scope or `beforeAll` — the pattern
 * `AddMealSheet.test.tsx:145` already uses — registers its opt-in BEFORE the
 * first test runs. Letting the global setup own the set meant its `beforeEach`
 * replaced it and the opt-in was gone before anything could consume it: the
 * option type-checked, read as an opt-out, and did nothing. The set lives with
 * the module (one per test file, since Jest resets the registry per file) and
 * is re-published after the global setup has installed its empty one.
 */
const partialFieldExemptions: FieldExemptions = new Set<string>();

function publishPartialFieldExemptions(): void {
  (
    globalThis as { __apolloPartialFieldExemptions?: FieldExemptions }
  ).__apolloPartialFieldExemptions = partialFieldExemptions;
}

/** Every `Type.field` the completed shape has and the fixture does not state. */
function collectOmittedFields(
  full: unknown,
  stated: unknown,
  out: FieldExemptions,
): void {
  if (Array.isArray(full)) {
    const statedList = Array.isArray(stated) ? stated : [];
    full.forEach((entry, index) =>
      collectOmittedFields(entry, statedList[index], out),
    );
    return;
  }
  if (!full || typeof full !== 'object') return;
  const fullRecord = full as Record<string, unknown>;
  const statedRecord =
    stated && typeof stated === 'object' && !Array.isArray(stated)
      ? (stated as Record<string, unknown>)
      : {};
  const typename =
    typeof fullRecord.__typename === 'string' ? fullRecord.__typename : undefined;
  for (const [key, value] of Object.entries(fullRecord)) {
    if (key === '__typename') continue;
    if (!(key in statedRecord)) {
      if (typename !== undefined) out.add(`${typename}.${key}`);
      continue;
    }
    collectOmittedFields(value, statedRecord[key], out);
  }
}

/**
 * Serve a per-operation mock's `result` completed from the real SDL. `error`
 * mocks, mocks with no result, and mocks marked partial pass through untouched.
 */
/**
 * Stable regardless of the caller's key order, so the memo below hits.
 *
 * Sorted RECURSIVELY, and deliberately not via `JSON.stringify`'s second
 * argument: that parameter is an allowlist applied at every depth, so
 * `JSON.stringify(vars, Object.keys(vars).sort())` serializes
 * `{ input: { items: [...] } }` as `{"input":{}}` — every call with a nested
 * variable collides on one key. Two concurrent adds then shared one completed
 * response and the second adopted the first's id.
 */
function variablesKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(variablesKey).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${variablesKey(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function completeMockedResponse(mock: MockedResponse): MockedResponse {
  if (isPartial(mock)) return mock;
  if (!('result' in mock) || mock.result === undefined) return mock;
  const { result } = mock;
  // Completion is per INVOCATION because it needs the variables the operation
  // actually fired with — but a mock's default `maxUsageCount` is unbounded and
  // a hook commonly refires the same operation with the same variables. Over a
  // 50-file sample that was 249 completion executions for 122 distinct
  // (operation, variables) pairs: 51% pure repeat work, at 43ms a call.
  //
  // Memoizing rather than capping `maxUsageCount`, because a cap changes what
  // the mock DOES — a hook that fires once more than the cap stops being
  // answered — while a memo changes only what it costs. Sound now that
  // completion is deterministic: the same inputs could not produce a different
  // result anyway. `recordMock` records variables in `request.variables`, not
  // here, so nothing observable is skipped on a hit.
  const memo = new Map<string, unknown>();
  return {
    ...mock,
    result: (vars: Record<string, unknown>) => {
      const resolved = typeof result === 'function' ? result(vars) : result;
      if (!resolved || !('data' in resolved) || resolved.data === undefined) {
        return resolved;
      }
      const key = variablesKey(vars);
      if (!memo.has(key)) {
        memo.set(
          key,
          completeFromSchema(mock.request.query, vars, resolved.data),
        );
      }
      return { ...resolved, data: memo.get(key) };
    },
  } as MockedResponse;
}

export function createApolloTestWrapper(options: ApolloTestOptions = {}) {
  const {
    operationMocks,
    mocks,
    resolvers,
    cache: providedCache,
  } = options as ResolvedApolloTestOptions;
  // The type union above makes this unreachable from TypeScript; the throw is
  // for a JavaScript caller and for an object assembled at runtime. Precedence
  // would discard the loser in silence, which is how a live suite came to run
  // its hook on defaults with all sixteen tests passing.
  if (operationMocks !== undefined && (mocks || resolvers)) {
    throw new Error(
      'Pass either `operationMocks` or `mocks`/`resolvers`, not both — the ' +
        'two mocking strategies cannot be combined, and combining them used ' +
        'to discard the second silently.',
    );
  }
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

  // An EMPTY array is still a choice of strategy: it says "no per-operation
  // mocks", not "answer everything from the schema". Falling through used to
  // hand 14 sites a link that answered every operation with generated data and
  // wrote it into the cache, possibly after teardown.
  if (operationMocks !== undefined) {
    // Completion is applied HERE rather than only in `recordMock`, so a plain
    // `{ request, result }` literal gets it too — the literal form is the one
    // most likely to be written by hand and to omit a field.
    // A test that opted into partial data will write incomplete records by
    // definition. Tell the missing-field guard in `__tests__/setup/globals.js`
    // which FIELDS that covers, so it excuses those and nothing else.
    for (const mock of operationMocks) {
      if (isPartial(mock)) registerPartialFieldExemptions(mock);
    }
    // Schema drift is checked HERE, synchronously, before anything mounts.
    // Raised from inside the `result` callback it was thrown from MockLink's
    // `setTimeout`, where it escapes rxjs as an uncaught exception: the test
    // failed as a 5s `waitFor` timeout with the real message relegated to a
    // secondary trace — the exact "names the wrong thing" mode the missing-field
    // guard restructured itself to avoid, and with `forceExit` it can vanish.
    for (const mock of operationMocks) {
      assertDocumentMatchesSchema(mock.request.query);
    }
    const completed = operationMocks.map(completeMockedResponse);
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
  const { mocks, resolvers, operationMocks, cache, ...rest } =
    options as ResolvedApolloTestOptions &
      Omit<RenderHookOptions<TProps>, 'wrapper'>;
  return renderHook(callback, {
    wrapper: createApolloTestWrapper({
      mocks,
      resolvers,
      operationMocks,
      cache,
    } as ApolloTestOptions),
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
  const { mocks, resolvers, operationMocks, cache, ...rest } =
    options as ResolvedApolloTestOptions & Omit<RenderOptions, 'wrapper'>;
  return render(ui, {
    wrapper: createApolloTestWrapper({
      mocks,
      resolvers,
      operationMocks,
      cache,
    } as ApolloTestOptions),
    ...rest,
  });
}

import type {
  DocumentNode,
  GraphQLResolveInfo,
  GraphQLSchema,
} from 'graphql';
import { typeFromAST } from 'graphql';
import {
  buildASTSchema,
  defaultFieldResolver,
  executeSync,
  parse,
  getNamedType,
  isAbstractType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  specifiedRules,
  validate,
  KnownDirectivesRule,
  NoUnusedVariablesRule,
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

/**
 * Every `__typename` the caller pinned, by the response path it sits at.
 *
 * The path is what makes a pin local. Keying by TYPE alone — the previous
 * shape — could only say "this union resolves to ValidationError" for the whole
 * response, and all 215 of the schema's result unions carry the same four error
 * members: pinning one member for one field forced it onto every other union
 * field in the operation, and pinning two members of one union disabled pinning
 * entirely (`chosen.length === 1`). Both are positional questions, so the
 * answer has to be positional too.
 *
 * List indices are deliberately NOT part of the path: two entries of one list
 * pinning different members of the same union is the one case this cannot
 * express, and paying for it would mean an execution per entry.
 */
function collectPinnedTypenames(
  value: unknown,
  fieldPath: string,
  out: Map<string, string>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectPinnedTypenames(entry, fieldPath, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (fieldPath !== '' && typeof record.__typename === 'string') {
    out.set(fieldPath, record.__typename);
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key === '__typename') continue;
    collectPinnedTypenames(
      nested,
      fieldPath === '' ? key : `${fieldPath}.${key}`,
      out,
    );
  }
}

/** Where the pin map travels: on the execution context, so the schema is shared. */
const PINNED_TYPENAMES = Symbol.for('apolloMockProvider.pinnedTypenames');

type PinContext = { [PINNED_TYPENAMES]?: Map<string, string> };

/** The response path of the field being resolved, minus list indices. */
function responsePathKey(from: GraphQLResolveInfo['path']): string {
  const parts: string[] = [];
  for (let node: typeof from | undefined = from; node; node = node.prev) {
    if (typeof node.key === 'string') parts.unshift(node.key);
  }
  return parts.join('.');
}

/**
 * Teach every abstract-typed field to honour a pin for its own position.
 *
 * `addMocksToSchema` resolves an abstract type by generating a value and
 * reading its `__typename` back (`typeResolver`), and the only hook it offers
 * is a zero-argument `mocks[UnionName]` — no position, no path. So the pin is
 * installed one level up, on the FIELD, where `info.path` is available. When
 * nothing is pinned for this position the original mock resolver runs and
 * `mockGenerationBehavior: 'deterministic'` picks the first possible type.
 */
function installAbstractTypePinning(schema: GraphQLSchema): void {
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type)) continue;
    for (const field of Object.values(type.getFields())) {
      const named = getNamedType(field.type);
      if (!isAbstractType(named)) continue;
      const possible = new Set(
        schema.getPossibleTypes(named).map(member => member.name),
      );
      const generate = field.resolve ?? defaultFieldResolver;
      field.resolve = (source, args, context, info) => {
        const pinned = (context as PinContext | undefined)?.[
          PINNED_TYPENAMES
        ]?.get(responsePathKey(info.path));
        if (pinned !== undefined && possible.has(pinned)) {
          return { __typename: pinned };
        }
        return generate(source, args, context, info);
      };
    }
  }
}

/** Paths where the caller stated something the operation cannot return. */
interface MergeReport {
  unknownKeys: string[];
}

/**
 * Collected during the test, thrown in `afterEach`.
 *
 * Completion runs inside MockLink's `result` callback, which MockLink invokes
 * from a `setTimeout` — a throw there escapes rxjs as an uncaught exception,
 * the mutation never settles, and the test fails as a timeout naming the wrong
 * thing (and with `forceExit` it can vanish entirely). So this takes the same
 * route the missing-field guard takes: collect without disturbing control flow,
 * report where it can fail the test that caused it.
 */
const unknownFixtureKeys: string[] = [];

function reportUnknownFixtureKeys(document: DocumentNode, keys: string[]): void {
  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === 'OperationDefinition',
  );
  const name = operation?.name?.value ?? 'an unnamed operation';
  for (const key of keys) unknownFixtureKeys.push(`${name}: ${key}`);
}

/**
 * Exported so the check's own ability to fail can be demonstrated. A guard that
 * has never been seen to fail is indistinguishable from one that cannot —
 * which is the defect class this whole change is about.
 */
export function throwOnUnknownFixtureKeys(): void {
  if (unknownFixtureKeys.length === 0) return;
  const seen = [...new Set(unknownFixtureKeys)];
  unknownFixtureKeys.length = 0;
  throw new Error(
    'Mocked response states fields the operation cannot return:\n' +
      seen.map(key => `  - ${key}`).join('\n') +
      '\n\nEither the operation does not select them, or the type does not ' +
      'have them. A fixture the schema cannot produce is a test of a system ' +
      'that does not exist.',
  );
}

/** Generated identity, recognisable by construction. */
const GENERATED_ID = /^mock-id-\d+$/;

/**
 * Give a merged list entry its own identity.
 *
 * The generated list is always two entries long
 * (`@graphql-tools/mock` `randomListLength`), so a caller stating three or more
 * reused the template for the rest — and with it the template's generated id.
 * Rows 0 and 2 then normalize onto ONE record and the third entry's data is
 * lost: a fixture stating `['Alpha','Beta','Gamma']` read back
 * `['Alpha','Beta','Alpha']`.
 *
 * Only values the caller did NOT state are re-issued, so a pinned id survives.
 */
function reissueGeneratedIds(merged: unknown, stated: unknown): unknown {
  if (Array.isArray(merged)) {
    const statedList = Array.isArray(stated) ? stated : [];
    return merged.map((entry, index) =>
      reissueGeneratedIds(entry, statedList[index]),
    );
  }
  if (!merged || typeof merged !== 'object') return merged;
  const statedRecord =
    stated && typeof stated === 'object' && !Array.isArray(stated)
      ? (stated as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(merged as Record<string, unknown>)) {
    if (key in statedRecord && typeof statedRecord[key] !== 'object') {
      out[key] = value;
    } else if (typeof value === 'string' && GENERATED_ID.test(value)) {
      out[key] = nextMockId();
    } else {
      out[key] = reissueGeneratedIds(value, statedRecord[key]);
    }
  }
  return out;
}

/** Caller data wins; anything it omits keeps the schema-generated value. */
function mergeOverSchema(
  base: unknown,
  override: unknown,
  fieldPath: string,
  report: MergeReport,
): unknown {
  // No override at this position at all — distinct from a key the caller wrote
  // as `undefined`, which the object branch below treats as a stated absence.
  if (override === undefined) return base;
  if (override === null || typeof override !== 'object') return override;
  if (Array.isArray(override)) {
    const template = Array.isArray(base) ? base : [];
    return override.map((entry, index) => {
      const merged = mergeOverSchema(
        template[index] ?? template[template.length - 1],
        entry,
        fieldPath,
        report,
      );
      return index < template.length
        ? merged
        : reissueGeneratedIds(merged, entry);
    });
  }
  const baseRecord =
    base && typeof base === 'object' && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : undefined;
  const merged: Record<string, unknown> = { ...(baseRecord ?? {}) };
  // Only a COMPOSITE position can be checked for unknown keys. The client
  // transform puts `__typename` in every selection set, so its presence is what
  // separates an entity from a custom scalar whose value happens to be an
  // object — `JSON` and `Upload` both are, and descending into one would report
  // the payload's own keys as fields the operation cannot return.
  const checkable =
    baseRecord !== undefined && (fieldPath === '' || '__typename' in baseRecord);
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    // A fixture stating a key the operation cannot return describes a response
    // that can never arrive. Nothing else on the test fieldPath checks it, so it
    // survives as a test of a system that does not exist.
    if (checkable && baseRecord && key !== '__typename' && !(key in baseRecord)) {
      report.unknownKeys.push(fieldPath === '' ? key : `${fieldPath}.${key}`);
      continue;
    }
    // A key the caller WROTE as `undefined` is a stated absence — the natural
    // `DeepPartial` spelling of "the API omitted this", and the case a test
    // asserting `toBeUndefined()` is about. Serving the schema's invented value
    // for it asserted against data the test did not write. (Distinct from the
    // top-level short-circuit above, which means "no override at all here".)
    if (value === undefined) {
      delete merged[key];
      continue;
    }
    merged[key] = mergeOverSchema(
      merged[key],
      value,
      fieldPath === '' ? key : `${fieldPath}.${key}`,
      report,
    );
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

// The document is validated in the form the CLIENT sends, so the two rules that
// only make sense before the link chain runs are dropped. `@connection`,
// `@nonreactive` and `@unmask` are all removed by Apollo before an operation
// goes out; validating them as unknown directives would hard-fail every mock
// for a paginated document with advice — "run `npm run codegen`" — that cannot
// resolve it. An unused variable is likewise the caller's business.
const MOCK_VALIDATION_RULES = specifiedRules.filter(
  rule => rule !== KnownDirectivesRule && rule !== NoUnusedVariablesRule,
);

export function assertDocumentMatchesSchema(query: DocumentNode) {
  if (schemaCheckedDocuments.has(query)) return;
  const document = transformLikeTheClient(query);
  const errors = validate(getBaseSchema(), document, MOCK_VALIDATION_RULES);
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
  const scalar = INPUT_SCALAR_PLACEHOLDERS[inner.name];
  if (typeof scalar === 'function') return (scalar as () => unknown)();
  return inner.name === 'Int' || inner.name === 'Float' ? 1 : 'mock-string';
}

// Input placeholders are the SAME every call, which the response mocks are not:
// `ID` there issues a fresh `mock-id-N` so two entities never collide on one
// cache key. Reusing that generator here made the variables differ between two
// completions of the same operation, and `MockStore` keys its generated values
// by field ARGUMENTS — so the second completion missed the cache, generated
// fresh entities, and the "byte-identical every run" promise failed for 179 of
// the 238 real operations. Variables only have to satisfy validation; a mocked
// schema ignores their values entirely.
const INPUT_SCALAR_PLACEHOLDERS: IMocks = {
  ...DEFAULT_SCALAR_MOCKS,
  ID: () => 'mock-input-id',
};

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

  const pinnedTypenames = new Map<string, string>();
  collectPinnedTypenames(overrideData, '', pinnedTypenames);
  const schema = getMockedSchema();
  const contextValue: PinContext = { [PINNED_TYPENAMES]: pinnedTypenames };

  // Caller's variables first so a variables-dependent mock sees them; then the
  // schema-valid set alone, because a caller value that fails validation must
  // not cost the whole completion.
  for (const variableValues of [
    schemaValidVariables(document, getBaseSchema(), variables),
    schemaValidVariables(document, getBaseSchema(), {}),
  ]) {
    let executed;
    try {
      executed = executeSync({ schema, document, variableValues, contextValue });
    } catch {
      executed = undefined;
    }
    if (executed?.data) {
      const report: MergeReport = { unknownKeys: [] };
      const merged = mergeOverSchema(executed.data, overrideData, '', report);
      if (report.unknownKeys.length > 0) {
        reportUnknownFixtureKeys(document, report.unknownKeys);
      }
      return merged;
    }
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
export function seedCache(entries: SeedEntry[]): InMemoryCache {
  // Production cache, for the reason on the default above — `seedCache` is the
  // other route to the same substitution and feeds 35 files.
  const cache = makeCache();
  for (const entry of entries) {
    const { data, fragment, fragmentName } = normalizeSeedEntry(entry);
    const identified = cache.identify(
      data as Parameters<InMemoryCache['identify']>[0],
    );
    cache.writeFragment({
      id: identified ?? `${data.__typename}:${data.id}`,
      fragment,
      ...(fragmentName === undefined ? {} : { fragmentName }),
      data,
    });
  }
  return cache;
}

type SeedData = Record<string, unknown> & { __typename: string; id: string };

/**
 * A seed checked against a REAL selection.
 *
 * The derived form below cannot be incomplete by construction — its selection
 * comes from the fixture's own keys — which removes the completeness contract
 * for every test that seeds. Passing the production document the consumer
 * actually reads restores it: a fixture too thin for that selection reports a
 * missing field instead of quietly defining its own idea of complete.
 */
export interface SeedWithFragment {
  data: SeedData;
  fragment: DocumentNode;
  fragmentName?: string;
}

export type SeedEntry = SeedData | SeedWithFragment;

function normalizeSeedEntry(entry: SeedEntry): SeedWithFragment {
  if ('fragment' in entry && entry.fragment !== undefined) {
    return entry as SeedWithFragment;
  }
  const data = entry as SeedData;
  return { data, fragment: buildFullFragment(data) };
}

// Build a fragment selecting every key on the given entry, at any depth.
// Sufficient for tests that just need readFragment to find the entity —
// production fragment selections happen via the codegen'd docs, and a seed that
// wants to be held to one passes it through `SeedWithFragment`.
function buildFullFragment(
  entry: Record<string, unknown> & { __typename: string },
): DocumentNode {
  return gql([
    `fragment Test_${entry.__typename}_${String(entry.id).replace(/[^a-zA-Z0-9]/g, '_')} on ${entry.__typename} { ${selectionSetFor(entry)} }`,
  ] as unknown as TemplateStringsArray);
}

/**
 * The selection for one record, recursing through nested entities AND lists.
 *
 * A list of identified entities used to be emitted as a bare field name, which
 * made Apollo store the whole array as an opaque value: the children got no
 * records of their own, `readFragment` on one returned null, every child-type
 * policy went unexercised, and a later normalized write to a child never
 * reached the parent's embedded copy. That is a store the production path could
 * never produce, which is the opposite of what seeding a production cache is
 * for.
 */
function selectionSetFor(record: Record<string, unknown>): string {
  const selections = Object.keys(record)
    .filter(key => key !== '__typename')
    .map(key => selectionFor(key, record[key]));
  return `__typename ${selections.join(' ')}`;
}

function selectionFor(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    // The union of the entries' keys, so a heterogeneous list keeps every
    // field some entry carries rather than only the first entry's.
    const merged: Record<string, unknown> = {};
    for (const entry of value) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        Object.assign(merged, entry as Record<string, unknown>);
      }
    }
    if (Object.keys(merged).length === 0) return key;
    return `${key} { ${selectionSetFor(merged)} }`;
  }
  if (value && typeof value === 'object' && '__typename' in value) {
    return `${key} { ${selectionSetFor(value as Record<string, unknown>)} }`;
  }
  return key;
}
