import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Shared plugin config used by both base types and per-operation outputs.
 */
const sharedConfig = {
  // React hooks configuration
  withHooks: true,
  withComponent: false,
  withHOC: false,

  // Disable unused generated code
  withRefetchFn: false,
  withMutationFn: false,
  withSuspenseQuery: false,

  // Apollo Client v4 configuration - React hooks from separate export
  apolloReactHooksImportFrom: '@apollo/client/react',
  apolloReactCommonImportFrom: '@apollo/client',

  // Document mode
  documentMode: 'documentNode',

  // Type safety improvements
  avoidOptionals: {
    field: true, // Changed to match server
    inputValue: false,
    object: false,
  },

  // Scalars - match your server config
  scalars: {
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
  },

  // Modern TypeScript
  useTypeImports: true,

  // Nullable handling - GraphQL returns null, never undefined
  maybeValue: 'T | null',
  inputMaybeValue: 'T | null | undefined', // Allows explicit null to clear fields

  // Error handling
  errorType: 'ApolloError',

  // Deduplication
  dedupeOperationSuffix: true,
  skipTypename: false,

  // Fragment handling
  inlineFragmentTypes: 'combine',
  nonOptionalTypename: true,

  // Immutable types
  immutableTypes: false,

  // Enum handling
  enumsAsTypes: false,

  // NEW for v6 - strict scalars
  strictScalars: true,

  // Tree-shaking: annotate generated code with /*#__PURE__*/ for Metro/Hermes
  pureMagicComment: true,
};

const addHeader = {
  add: {
    content: [
      '// This file is auto-generated. Do not edit manually.',
      '/* eslint-disable */',
      '// @ts-nocheck',
    ].join('\n'),
  },
};

const config: CodegenConfig = {
  overwrite: true,
  schema: process.env.SCHEMA_PATH || 'src/graphql/generated/schema.graphql',

  documents: [
    'src/graphql/operations/**/*.{graphql,gql}',
    'src/features/*/graphql/*.{graphql,gql}',
    '!src/graphql/generated/**/*.{ts,tsx}',
    '!src/**/node_modules/**',
  ],

  ignoreNoDocuments: true,

  generates: {
    // 1. Base schema types (enums, input types, object types, scalars)
    //    Shared by all per-operation generated files.
    'src/graphql/generated/baseTypes.ts': {
      plugins: [addHeader, 'typescript'],
      config: sharedConfig,
    },

    // 2. Per-operation generated files (near each .graphql source)
    //    Each .graphql gets a sibling .generated.ts with its hooks + operation types.
    //    These import base types from baseTypes.ts via calculated relative paths.
    'src/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: 'graphql/generated/baseTypes.ts',
      },
      plugins: [addHeader, 'typescript-operations', 'typescript-react-apollo'],
      config: sharedConfig,
    },

    // 3. Fragment matcher for Apollo cache
    'src/graphql/generated/fragmentMatcher.json': {
      plugins: ['fragment-matcher'],
      config: {
        apolloClientVersion: 4,
      },
    },
  },

  hooks: {
    afterAllFileWrite: ['echo "GraphQL types generated successfully"'],
  },
};

export default config;
