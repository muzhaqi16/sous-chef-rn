/**
 * RNGH's ScrollView injects its scroll gesture into the refresh control as
 * `cloneElement(refreshControl, { block })`, and `ThemedRefreshControl` is a
 * `withUnistyles` wrapper. The INSTALLED withUnistyles forwards
 * `deepMergeObjects(mappingsProps, unistyleProps, props)`, which must hand
 * `block` on by REFERENCE: a copy is a different gesture, and the scroll and
 * refresh arbitration silently doesn't happen.
 * Verified: #rnghs-scroll-gesture-reaches-only-rnghs-refreshcontrol
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as ts from 'typescript';
import { runInNewContext } from 'vm';

type Props = Record<string, unknown>;

const ROOT = dirname(require.resolve('react-native-unistyles/package.json'));

const read = (relative: string): string =>
  readFileSync(join(ROOT, relative), 'utf8');

// Metro bundles the package's TypeScript source, its `react-native` entry.
const utils = ts.transpileModule(read('src/utils.ts'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

/** The package's own `deepMergeObjects`, run over `sources`. */
const deepMergeObjects = (...sources: Props[]): Props | undefined => {
  const sandbox: {
    exports: Props;
    sources: Props[];
    merged: Props | undefined;
  } = {
    exports: {},
    sources,
    merged: undefined,
  };
  runInNewContext(
    `${utils}\nmerged = exports.deepMergeObjects(...sources);`,
    sandbox,
  );
  return sandbox.merged;
};

describe('withUnistyles prop passthrough', () => {
  it('forwards the props it is given through deepMergeObjects', () => {
    expect(read('src/core/withUnistyles/withUnistyles.native.tsx')).toContain(
      '...deepMergeObjects(mappingsProps, unistyleProps, props),',
    );
  });

  it('passes an injected `block` through by reference and keeps the theme mapping', () => {
    const scrollGesture = { __nativeGesture: true, handlerTag: 42 };

    const finalProps = deepMergeObjects(
      { colors: ['#7C3AED'], tintColor: '#7C3AED' },
      {},
      { refreshing: false, onRefresh: () => {}, block: scrollGesture },
    );

    expect(finalProps?.block).toBe(scrollGesture);
    expect(finalProps?.tintColor).toBe('#7C3AED');
  });
});
