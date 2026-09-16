/**
 * The feature API boundary, exercised through the config that ships.
 *
 * A policy that matches nothing reports nothing, which reads exactly like a
 * clean tree — so these assert what the boundary BLOCKS, not only what it
 * allows. Each case lints synthetic text at a real file's path: the type-aware
 * parser needs the file to be in the tsconfig program, and a path that is not
 * fails to parse, which would make every case pass vacuously.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

type Case = {
  label: string;
  filePath: string;
  code: string;
  blocked: boolean;
};

const VALUE_USE = 'export const y: unknown = x;\n';

const RECIPES_HOOK = 'src/features/recipes/hooks/useDeferredSearch.ts';

const CASES: Case[] = [
  {
    label: "another feature's utils, imported for a value",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "another feature's offline queue surface",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/offline/syncBuilders';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    label: "another feature's generated documents, imported for a value",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/graphql/pantry.generated';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // The allowance that replaced a per-feature `except` list.
    label: "another feature's generated fragment, imported as a TYPE",
    filePath: RECIPES_HOOK,
    code: "import type { X } from '#features/pantry/graphql/pantryFragments.generated';\nexport type Y = X;\n",
    blocked: false,
  },
  {
    label: "another feature's public hook",
    filePath: RECIPES_HOOK,
    code: `import { x } from '#features/pantry/hooks/pantryDataTypes';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    // The capture negation: same feature, same directory, allowed.
    label: "the same feature's own internals",
    filePath: 'src/features/pantry/screens/FilteredPantryItems.tsx',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    label: "shared code reaching into a feature's utils",
    filePath: 'src/hooks/useAppearance.ts',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
  {
    // `offline/` exists for the queue, and the queue IS shared code.
    label: 'the offline queue importing a feature’s replay builders',
    filePath: 'src/apollo/offlineQueue/syncRegistry.ts',
    code: `import { x } from '#features/pantry/offline/syncBuilders';\n${VALUE_USE}`,
    blocked: false,
  },
  {
    // Matching by capture covers a feature nobody added to a list.
    label: 'a feature no zone ever enumerated',
    filePath: 'src/features/onboarding/hooks/useCompleteOnboarding.ts',
    code: `import { x } from '#features/pantry/utils/hybridSort';\n${VALUE_USE}`,
    blocked: true,
  },
];

/**
 * The composed config loads ESM-only graphql-eslint dependencies Jest cannot
 * transform, so it runs in a plain Node process.
 */
const lint = (cases: Case[]) => {
  const script = `
    const { ESLint } = require('eslint');
    const eslint = new ESLint();
    const cases = ${JSON.stringify(cases)};
    (async () => {
      const out = [];
      for (const c of cases) {
        const [result] = await eslint.lintText(c.code, { filePath: c.filePath });
        out.push({
          label: c.label,
          parseError: result.messages.some(m => !m.ruleId),
          blocked: result.messages.some(
            m =>
              m.ruleId === 'boundaries/dependencies' ||
              m.ruleId === 'import/no-restricted-paths',
          ),
        });
      }
      process.stdout.write(JSON.stringify(out));
    })();
  `;
  const output = execFileSync('node', ['-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(output) as Array<{
    label: string;
    parseError: boolean;
    blocked: boolean;
  }>;
};

describe('feature API boundary', () => {
  const results = lint(CASES);

  it('parses every case, so none passes vacuously', () => {
    expect(results.filter(r => r.parseError).map(r => r.label)).toEqual([]);
    expect(results).toHaveLength(CASES.length);
  });

  it('blocks and allows exactly what the boundary says', () => {
    expect(results.map(r => ({ label: r.label, blocked: r.blocked }))).toEqual(
      CASES.map(c => ({ label: c.label, blocked: c.blocked })),
    );
  });
});
