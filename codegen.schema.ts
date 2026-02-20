import type { CodegenConfig } from '@graphql-codegen/cli';
import { execSync } from 'child_process';

const API_URL = process.env.API_URL || 'http://localhost:4000/graphql';

function isApiAvailable(url: string): boolean {
  try {
    execSync(
      `curl -sf -o /dev/null -m 3 -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}' "${url}"`,
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

if (!isApiAvailable(API_URL)) {
  console.log(`⚠ API unreachable at ${API_URL} – skipping schema pull, using existing local schema`);
  process.exit(0);
}

console.log(`✓ Pulling schema from ${API_URL}`);

const config: CodegenConfig = {
  overwrite: true,
  schema: API_URL,
  generates: {
    'src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
        includeIntrospectionTypes: false,
      },
    },
  },
};

export default config;
