import { readFileSync } from 'fs';
import path from 'path';

/**
 * Metro takes the first `exports` condition it holds, in the order the package
 * lists them: the preset's `react-native`, plus `import` for an ESM import or
 * `require`. Were `import` listed first (as in 3.6.0), the app's imports would
 * land in lib/module while the Babel plugin's component imports land in src:
 * two copies, each with its own ShadowRegistry, and a theme change reaches one.
 */

const MANIFEST = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  'react-native-unistyles',
  'package.json',
);

const { exports: entryPoints } = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  exports: Record<string, unknown>;
};

const resolveTarget = (
  target: unknown,
  conditions: ReadonlySet<string>,
): unknown => {
  if (typeof target !== 'object' || target === null) return target;
  for (const [condition, next] of Object.entries(target)) {
    if (condition === 'default' || conditions.has(condition)) {
      return resolveTarget(next, conditions);
    }
  }
  return null;
};

const AS_IMPORT = new Set(['react-native', 'import']);
const AS_REQUIRE = new Set(['react-native', 'require']);

describe('Unistyles resolves to one copy under Metro', () => {
  it('reads the export map the app resolves through', () => {
    expect(resolveTarget(entryPoints['.'], AS_IMPORT)).toBe('./src/index.ts');
  });

  it.each(Object.keys(entryPoints))(
    'lands an import and a require of %s on the same file',
    entry => {
      expect(resolveTarget(entryPoints[entry], AS_IMPORT)).toBe(
        resolveTarget(entryPoints[entry], AS_REQUIRE),
      );
    },
  );
});
