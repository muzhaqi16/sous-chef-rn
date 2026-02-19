import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true, // Add this for v6
  schema: process.env.SCHEMA_PATH || 'src/graphql/generated/schema.graphql',

  documents: [
    'src/graphql/operations/**/*.{graphql,gql}',
    '!src/graphql/generated/**/*.{ts,tsx}',
    '!src/**/node_modules/**',
  ],

  ignoreNoDocuments: true,

  generates: {
    'src/graphql/generated/index.ts': {
      plugins: [
        {
          add: {
            content: [
              '// This file is auto-generated. Do not edit manually.',
              '/* eslint-disable */',
              '// @ts-nocheck',
            ].join('\n'),
          },
        },
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        // React hooks configuration
        withHooks: true,
        withComponent: false,
        withHOC: false,

        // Disable unused generated code
        withRefetchFn: false,
        withMutationFn: false,

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
      },
    },

    // Fragment matcher - update version
    'src/graphql/generated/fragmentMatcher.json': {
      plugins: ['fragment-matcher'],
      config: {
        apolloClientVersion: 4,
      },
    },

    // Schema file
    'src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
        includeIntrospectionTypes: false,
      },
    },
  },

  // Watch mode - moved outside config in v6
  watch: process.env.NODE_ENV === 'development',

  // Hooks
  hooks: {
    afterAllFileWrite: [
      'echo "GraphQL types generated successfully"',
    ],
  },
};

export default config;
