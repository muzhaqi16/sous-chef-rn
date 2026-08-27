/**
 * Pins WHY `babel.config.js` orders the Unistyles plugin, a scope re-crawl, and
 * the React Compiler the way it does.
 *
 * The claim is a three-way one, and every leg has to hold or the ordering is
 * wrong:
 *
 *   [unistyles, compiler]          → CompileError, function skipped entirely
 *   [compiler, unistyles]          → compiles, but the variant read is STALE
 *   [unistyles, crawl, compiler]   → compiles AND the read is in the cache key
 *
 * The middle leg is the one that bites: it looks healthy (0 bailouts, full
 * memoization) while silently freezing every variant style at its first-render
 * value. That is what shipped a button stuck looking disabled and a success
 * toast with the default container behind green text.
 *
 * Root cause of the first leg, and the reason the third exists at all:
 * `extractVariants` in react-native-unistyles rewrites the component body by
 * assigning `path.node.body` directly, declaring a shadowing
 * `const styles = _styles.useVariants(...)`, and never calls `scope.crawl()`.
 * Babel's scope table has no binding for it, so the compiler aborts the
 * function. The crawl is the whole fix; drop it and leg one returns.
 *
 *   node scripts/probe-unistyles-compiler-order.mjs
 *
 * Exits non-zero if any leg stops behaving as recorded — which is the signal
 * that the upstream bug was fixed (delete the crawl plugin) or that the
 * compiler changed its cache-key shape (re-read this file's assumptions).
 */
import babel from '@babel/core';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { join } from 'path';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const resolveFromRepo = createRequire(import.meta.url).resolve;

const UNISTYLES = [
  resolveFromRepo('react-native-unistyles/plugin'),
  { root: 'src' },
];
const CRAWL = join(REPO_ROOT, 'scripts/babel/unistyles-scope-crawl.js');
const COMPILER = resolveFromRepo('babel-plugin-react-compiler');

// Minimal reproduction: one variant-bearing style, one variant input that
// moves, one unrelated prop for the compiler to key the cache on instead.
const FIXTURE = `
import { StyleSheet } from 'react-native-unistyles';
export function Button({ disabled, style }) {
  styles.useVariants({ disabled });
  return <Pressable style={[styles.button, style]} />;
}
const styles = StyleSheet.create(() => ({
  button: { variants: { disabled: { true: { opacity: 0.5 } } } },
}));
`;

const compile = plugins => {
  try {
    const { code } = babel.transformSync(FIXTURE, {
      filename: join(REPO_ROOT, 'src/ProbeFixture.tsx'),
      root: REPO_ROOT,
      babelrc: false,
      configFile: false,
      presets: [
        [
          resolveFromRepo('@react-native/babel-preset'),
          { disableImportExportTransform: true },
        ],
      ],
      plugins,
    });
    return { code };
  } catch (error) {
    return { error: error.message.split('\n')[0] };
  }
};

/** Did the compiler put the variant-resolved style read in its own cache key? */
const readIsTracked = code =>
  /if\([^)]*\$\[\d+\]!==[A-Za-z_$][\w$]*\.button[^)]*\)/.test(code);

const memoized = code => code.includes('react/compiler-runtime');

const legs = [
  {
    name: 'docs order [unistyles, compiler]',
    plugins: [UNISTYLES, COMPILER],
    // The build does NOT fail. The compiler catches its own
    // `(BuildHIR::lowerAssignment) Could not find binding for declaration`,
    // logs it, and emits the original function — so the only observable is the
    // absence of `react/compiler-runtime`. That silence is exactly why the
    // inverted order was adopted instead: nothing surfaces the loss.
    expect: r => !r.error && !memoized(r.code),
    describe:
      'the shadowed binding is unresolvable, so the function is skipped',
  },
  {
    name: 'inverted   [compiler, unistyles]',
    plugins: [COMPILER, UNISTYLES],
    expect: r => !r.error && memoized(r.code) && !readIsTracked(r.code),
    describe: 'compiles, but the style read is NOT a cache dependency — stale',
  },
  {
    name: 'shipped    [unistyles, crawl, compiler]',
    plugins: [UNISTYLES, CRAWL, COMPILER],
    expect: r => !r.error && memoized(r.code) && readIsTracked(r.code),
    describe: 'compiles AND the style read is a cache dependency — fresh',
  },
];

let failed = false;
for (const leg of legs) {
  const result = compile(leg.plugins);
  const ok = leg.expect(result);
  if (!ok) failed = true;
  console.log(`${ok ? '✓' : '✗'} ${leg.name}`);
  console.log(`    expected: ${leg.describe}`);
  console.log(
    `    actual:   ${
      result.error
        ? `CompileError — ${result.error}`
        : `compiled, memoized=${memoized(
            result.code,
          )}, read tracked=${readIsTracked(result.code)}`
    }\n`,
  );
}

if (failed) {
  console.error(
    '✗ The plugin-ordering claim in babel.config.js no longer holds.\n\n' +
      '  If the docs order stopped erroring, the upstream scope bug is fixed:\n' +
      '  delete scripts/babel/unistyles-scope-crawl.js and this probe, and\n' +
      '  restore the plain documented order.\n',
  );
  process.exit(1);
}

console.log('✓ All three legs behave as babel.config.js records.');
