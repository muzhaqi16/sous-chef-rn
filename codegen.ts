import type { CodegenConfig } from '@graphql-codegen/cli';

const getEndpoint = () => {
  return process.env.API_URL || 'http://localhost:4000/graphql';
};
const endpoint = getEndpoint();

const config: CodegenConfig = {
  overwrite: true, // Add this for v6
  schema: [
    {
      [endpoint]: {
        headers: {
          'x-api-key':
            process.env.API_KEY || 'mobile_ck_your_secure_random_key_here',
          'Content-Type': 'application/json',
        },
      },
    },
  ],

  documents: [
    'src/graphql/operations/fragments.graphql',
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
          DateTime: 'string', // or 'Date' to match server
          Date: 'string', // or 'Date' to match server
          JSON: 'any',
          Upload: 'File',
        },

        // Modern TypeScript
        useTypeImports: true,

        // Nullable handling - match server style
        maybeValue: 'T | null | undefined',
        inputMaybeValue: 'T | undefined', // Match server

        // Error handling
        errorType: 'ApolloError',

        // Deduplication
        dedupeOperationSuffix: true,
        skipTypename: false,

        // Fragment handling
        inlineFragmentTypes: 'combine',
        nonOptionalTypename: false,

        // Immutable types
        immutableTypes: false,

        // Enum handling
        enumsAsTypes: false,

        // Subscription hooks
        withRefetchFn: true,
        withMutationFn: true,

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

    // Introspection
    'src/graphql/generated/introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: true,
      },
    },

    // Schema file
    'src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
        includeIntrospectionTypes: true,
        // Remove 'sort' if causing issues
      },
    },

    // Types only file
    'src/graphql/generated/types.ts': {
      plugins: [
        {
          add: {
            content: '// Shared GraphQL types - no hooks',
          },
        },
        'typescript',
        'typescript-operations',
      ],
      config: {
        onlyOperationTypes: false,
        skipTypename: false,
        useTypeImports: true,
        strictScalars: true, // Add for v6
        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'any',
          Upload: 'File',
        },
        maybeValue: 'T | null | undefined',
        inputMaybeValue: 'T | undefined',
      },
    },
  },

  // Updated config structure for v6
  config: {
    skipDocumentsValidation: false,
    silent: false,
    errorsOnly: false,
  },

  // Watch mode - moved outside config in v6
  watch: process.env.NODE_ENV === 'development',

  // Hooks
  hooks: {
    afterOneFileWrite: ['prettier --write'],
    afterAllFileWrite: [
      'echo "✅ Mobile GraphQL types generated successfully!"',
    ],
  },
};

export default config;
