import type { CodegenConfig } from '@graphql-codegen/cli';

// Apollo Client v4 codegen setup, per
// https://www.apollographql.com/docs/react/development-testing/graphql-codegen
//
// - `typescript` emits the shared schema types (enums, scalars, input objects)
//   into `schemaTypes.ts`.
// - `near-operation-file` preset emits a `<name>.generated.ts` next to every
//   `<name>.graphql` with the typed `TypedDocumentNode` exports and operation
//   result/variable types. Call sites import the precompiled `XxxDocument` and
//   pass it to `useQuery` / `useMutation` from `@apollo/client/react`.
// - `client-preset` is intentionally NOT used. Apollo's docs are explicit:
//   "We do not recommend using the client preset with Apollo Client apps
//   because it generates additional runtime code that adds bundle size to your
//   application and includes features that are incompatible with Apollo Client."
//   The `typed-document-node` plugin produces all the runtime DocumentNodes we
//   need, and `FragmentType<typeof Doc>` from `@apollo/client` works directly
//   with our outputs once `dataMasking: true` is enabled.

const ALL_OPERATIONS = [
  'src/**/*.{graphql,gql}',
  '!src/graphql/generated/**/*.{ts,tsx}',
  '!src/**/node_modules/**',
];

const SCALARS = {
  DateTime: 'string',
  Date: 'string',
  JSON: 'any',
  Upload: '{ uri: string; type: string; name: string }',
  BigInt: 'string',
  IPv4: 'string',
  FlexibleQuantity: {
    input: 'string | number',
    output: 'string',
  },
};

const config: CodegenConfig = {
  overwrite: true,
  schema: process.env.SCHEMA_PATH || 'src/graphql/generated/schema.graphql',

  ignoreNoDocuments: true,

  generates: {
    // Apollo fragment matcher — required for proper interface/union type
    // resolution in the InMemoryCache (see `src/apollo/cache.ts`).
    'src/graphql/generated/fragmentMatcher.json': {
      documents: ALL_OPERATIONS,
      plugins: ['fragment-matcher'],
      config: {
        apolloClientVersion: 4,
      },
    },

    // Shared schema types — scalars, enums, input objects, schema-wide types.
    // Imported by every per-file `*.generated.ts` via `baseTypesPath`.
    'src/graphql/generated/schemaTypes.ts': {
      plugins: ['typescript'],
      config: {
        scalars: SCALARS,
        useTypeImports: true,
        maybeValue: 'T | null',
        inputMaybeValue: 'T | null | undefined',
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
        },
        enumsAsTypes: false,
        strictScalars: true,
        nonOptionalTypename: true,
      },
    },

    // Per-file operation types + TypedDocumentNode.
    // Emits `<name>.generated.ts` next to every `<name>.graphql`.
    'src/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: 'graphql/generated/schemaTypes.ts',
      },
      documents: ALL_OPERATIONS,
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        scalars: SCALARS,
        useTypeImports: true,
        maybeValue: 'T | null',
        inputMaybeValue: 'T | null | undefined',
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
        },
        dedupeOperationSuffix: true,
        skipTypename: false,
        inlineFragmentTypes: 'combine',
        nonOptionalTypename: true,
        immutableTypes: false,
        strictScalars: true,
        pureMagicComment: true,
      },
    },
  },

  hooks: {
    afterAllFileWrite: ['echo "GraphQL types generated successfully"'],
  },
};

export default config;
