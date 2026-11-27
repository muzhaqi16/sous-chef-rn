import fs from 'fs';
import path from 'path';
import micromatch from 'micromatch';
import * as ts from 'typescript';
import { nodesOf, parseSource } from '#/test-utils/sourceAst';

/**
 * CI restores the generated GraphQL files from a cache keyed on codegen's
 * inputs. An input the key misses leaves stale output restored over a
 * change: a generator edited, its old output passing every check. The inputs
 * are walked from the `codegen` script itself, through every local module a
 * generator loads.
 */

const ROOT = path.join(__dirname, '..', '..');
const ACTION = '.github/actions/setup-deps/action.yml';

/** The `hashFiles(...)` patterns of the codegen cache key. */
const keyPatterns = (action: string): string[] => {
  const key = /id: cache-codegen[\s\S]*?\n\s+key: (.*)/.exec(action)?.[1] ?? '';
  const args = /hashFiles\(([^)]*)\)/.exec(key)?.[1] ?? '';
  return [...args.matchAll(/'([^']+)'/g)].map(([, pattern = '']) => pattern);
};

const scripts = (
  JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

/** The files a script names, following `npm run` into the scripts it runs. */
const filesOfScript = (name: string): string[] =>
  (scripts[name] ?? '').split('&&').flatMap(step => {
    const command = step.trim();
    const run = /^npm run (\S+)/.exec(command);
    if (run?.[1]) return filesOfScript(run[1]);
    return [...command.matchAll(/(\S+\.(?:ts|mjs|js))\b/g)].map(
      ([, file = '']) => file,
    );
  });

const LOCAL = /^\.\.?\//;

/** Local modules a file loads: imports, requires, and plugin paths it names. */
const localDependencies = (file: string): string[] => {
  const dir = path.dirname(file);
  return nodesOf(parseSource(path.join(ROOT, file)))
    .filter(ts.isStringLiteral)
    .map(node => node.text)
    .filter(text => LOCAL.test(text))
    .map(text => path.normalize(path.join(dir, text)))
    .flatMap(target => ['', '.js', '.mjs', '.ts'].map(ext => target + ext))
    .filter(candidate => {
      const absolute = path.join(ROOT, candidate);
      return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
    });
};

const inputsOf = (entries: string[]): string[] => {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    localDependencies(file).forEach(visit);
  };
  entries.forEach(visit);
  return [...seen].sort();
};

const uncovered = (files: string[], patterns: string[]) =>
  files.filter(file => !micromatch.isMatch(file, patterns));

describe('the codegen cache key', () => {
  const patterns = keyPatterns(
    fs.readFileSync(path.join(ROOT, ACTION), 'utf8'),
  );
  const inputs = inputsOf(filesOfScript('codegen'));

  it('reads the key and walks the generators', () => {
    expect(patterns.length).toBeGreaterThan(3);
    expect(inputs).toEqual(
      expect.arrayContaining([
        'codegen.ts',
        'scripts/generate-readers-fragments.mjs',
        'scripts/lib/mutationDocumentsPlugin.js',
      ]),
    );
  });

  it('catches an input it does not cover', () => {
    expect(uncovered(['scripts/other/plugin.js'], patterns)).toEqual([
      'scripts/other/plugin.js',
    ]);
  });

  it('covers every module the generators load', () => {
    expect(uncovered(inputs, patterns)).toEqual([]);
  });

  it('covers the operation documents, the schema and the plugin versions', () => {
    const { OPERATION_ROOTS } = jest.requireActual<{
      OPERATION_ROOTS: string[];
    }>('../../scripts/lib/sourceRoots.js');

    expect(
      uncovered(
        [
          ...OPERATION_ROOTS.map(root => `${root}/any/where.graphql`),
          'src/graphql/generated/schema.graphql',
          'package.json',
          'package-lock.json',
        ],
        patterns,
      ),
    ).toEqual([]);
  });
});
