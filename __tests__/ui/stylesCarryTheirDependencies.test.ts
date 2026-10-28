import { readFileSync } from 'fs';
import path from 'path';
import { transformSync, type PluginItem } from '@babel/core';
import { sync as glob } from 'glob';
import { PRODUCTION_ROOT_DIRS } from '#/test-utils/sourceRoots';

/**
 * Every Unistyles style carries the dependencies it reads. The Babel plugin
 * attaches them only to the object literals a style returns, directly or through
 * a ternary, `&&` or `||`; a style returned any other way (from a `switch`, loop
 * or `try`, as a call result) gets none and keeps the theme it first rendered
 * with. With `debug: true` the plugin warns about each such style.
 */

const REPO_ROOT = path.join(__dirname, '..', '..');
const PLUGIN = 'react-native-unistyles/plugin';

const { plugins } = (
  require('../../babel.config.js') as (api: {
    env: (name: string) => boolean;
  }) => { plugins: PluginItem[] }
)({ env: () => false });

const pluginOptions = plugins.find(
  (entry): entry is [string, Record<string, unknown>] =>
    Array.isArray(entry) && entry[0] === PLUGIN,
)?.[1];

/** The plugin's warnings for `source`, compiled as the app compiles `file`. */
const untrackedStylesIn = (file: string, source: string): string[] => {
  const warnings: string[] = [];
  const warn = jest
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      warnings.push(args.join(' '));
    });
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  // The plugin compiles nothing while NODE_ENV is 'test', which Jest sets.
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  transformSync(source, {
    filename: file,
    cwd: REPO_ROOT,
    root: REPO_ROOT,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [[PLUGIN, { ...pluginOptions, debug: true }]],
  });
  process.env.NODE_ENV = nodeEnv;
  warn.mockRestore();
  log.mockRestore();
  return warnings;
};

const stylesheets = PRODUCTION_ROOT_DIRS.flatMap(dir =>
  glob('**/*.{ts,tsx}', {
    cwd: dir,
    absolute: true,
    ignore: [
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/*.generated.ts',
      '**/*.d.ts',
    ],
  }),
)
  .map(file => ({ file, source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => source.includes('StyleSheet.create'));

describe('Unistyles styles carry their dependencies', () => {
  it('compiles with the plugin options babel.config.js ships', () => {
    expect(pluginOptions).toBeDefined();
  });

  it('reads the stylesheets it judges', () => {
    expect(stylesheets.length).toBeGreaterThan(300);
  });

  it('leaves no style without its dependencies', () => {
    expect(
      stylesheets.flatMap(({ file, source }) =>
        untrackedStylesIn(file, source),
      ),
    ).toEqual([]);
  });

  it('names a style returned from a switch', () => {
    const source = `
      import { StyleSheet } from 'react-native-unistyles';
      export const styles = StyleSheet.create(theme => ({
        badge: (tone: 'muted' | 'accent') => {
          switch (tone) {
            case 'accent':
              return { color: theme.colors.primary };
            default:
              return { color: theme.colors.text };
          }
        },
      }));
    `;
    const [warning] = untrackedStylesIn(
      path.join(PRODUCTION_ROOT_DIRS[0]!, 'Synthetic.tsx'),
      source,
    );

    expect(warning).toContain('styles.badge');
  });
});
