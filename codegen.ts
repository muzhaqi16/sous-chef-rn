import type {CodegenConfig} from '@graphql-codegen/cli';

const endpoint = 'http://localhost:4000/graphql';

const config: CodegenConfig = {
  // You can point to a local schema file or remote endpoint:
  // For remote introspection:
  schema: endpoint,
  // Or local schema file:
  //   schema: './schema.graphql',

  // Include both inline gql in TS/TSX and any standalone .graphql files:
  documents: [
    // include all your real .ts/.tsx/.graphql/.gql files…
    'src/**/*.{ts,tsx,graphql,gql}',
    // …but explicitly ignore the generated file
    '!src/graphql/generated.ts',
  ],
  // ignore the generates file
  ignoreNoDocuments: true,

  generates: {
    'src/graphql/generated.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withTypedDocumentNode: true,
      },
    },
    // Optionally, you can also generate a local copy of schema:
    // 'schema.graphql': { plugins: ['schema-ast'] },
  },
};

export default config;
