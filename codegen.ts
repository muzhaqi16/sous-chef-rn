import type {CodegenConfig} from '@graphql-codegen/cli';

// Environment-based endpoint configuration
const getEndpoint = () => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return process.env.GRAPHQL_ENDPOINT || 'https://your-api.com/graphql';
    case 'staging':
      return process.env.GRAPHQL_ENDPOINT || 'https://staging-api.com/graphql';
    default:
      return process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
  }
};

const endpoint = getEndpoint();

const config: CodegenConfig = {
  // Remote introspection with headers for authentication if needed
  schema: [
    {
      [endpoint]: {
        headers: {
          // Add auth headers if your GraphQL endpoint requires them
          // Authorization: 'Bearer ${GRAPHQL_TOKEN}',
          'Content-Type': 'application/json',
        },
      },
    },
  ],

  // Include GraphQL documents from your mobile app
  documents: [
    // TypeScript/JavaScript files with gql tags
    'src/**/*.{ts,tsx,js,jsx}',
    // Standalone GraphQL files
    'src/**/*.{graphql,gql}',
    // Exclude generated files
    '!src/graphql/generated/**/*.{ts,tsx}',
    // Exclude node_modules and other irrelevant paths
    '!src/**/node_modules/**',
  ],

  ignoreNoDocuments: true,

  generates: {
    // Main generated types and hooks
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

        // Apollo Client configuration
        apolloReactCommonImportFrom: '@apollo/client',
        apolloReactHooksImportFrom: '@apollo/client',

        // Type safety improvements
        avoidOptionals: {
          field: false,
          inputValue: false,
          object: false,
        },

        // Scalars for mobile (dates as strings)
        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'any',
          Upload: 'File',
        },

        // Code style preferences
        useTypeImports: true,
        maybeValue: 'T | null | undefined',
        inputMaybeValue: 'T | null | undefined',

        // Error handling
        errorType: 'ApolloError',

        // Deduplication and naming
        dedupeOperationSuffix: true,
        skipTypename: false,
        flattenGeneratedTypes: false,
      },
    },

    // Generate fragment matcher for Apollo Client (for unions/interfaces)
    'src/graphql/generated/fragmentMatcher.json': {
      plugins: ['fragment-matcher'],
      config: {
        apolloClientVersion: 3,
      },
    },

    // Generate introspection result for offline schema
    'src/graphql/generated/introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: true,
      },
    },

    // Generate a local schema file for development/debugging
    'src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
        sort: true,
      },
    },

    // Generate TypeScript types only (no hooks) for shared types
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
        scalars: {
          DateTime: 'string',
          Date: 'string',
          JSON: 'any',
        },
      },
    },
  },

  // Global configuration
  config: {
    // Validation
    skipDocumentsValidation: false,

    // Performance
    silent: false,
    errorsOnly: false,

    // Watch mode for development
    watch: process.env.NODE_ENV === 'development',
  },

  // Hooks for post-processing
  hooks: {
    afterOneFileWrite: [
      // Format generated files
      'prettier --write',
      // Optional: Run ESLint fix
      // 'eslint --fix',
    ],
    afterAllFileWrite: [
      'echo "✅ Mobile GraphQL types generated successfully!"',
    ],
  },
};

export default config;
