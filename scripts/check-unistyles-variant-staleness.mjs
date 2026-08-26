/**
 * Fails when more components can render a STALE `styles.useVariants(...)` value
 * than the recorded baseline allows.
 *
 * ## The mechanism
 *
 * `babel.config.js` runs `babel-plugin-react-compiler` BEFORE the Unistyles
 * plugin, deliberately — the other order makes the compiler bail out of the
 * whole file (see `check-compiler-bailouts.mjs`). The cost of that choice is
 * this bug, and it was never measured until now.
 *
 * The Unistyles plugin rewrites
 *
 *     styles.useVariants({ disabled });
 *     return <Pressable style={[styles.button, style]} />;
 *
 * into a shadowed local that carries the resolved variants:
 *
 *     const _styles = styles;
 *     { const _styles2 = _styles.useVariants({ disabled });
 *       return <Pressable style={[_styles2.button, style]} />; }
 *
 * But the compiler has already run. It saw `styles` as a stable module global,
 * so it wrapped the style read in a cache block keyed on the OTHER values in
 * the expression:
 *
 *     if ($[3] !== style) { t2 = [_styles2.button, style]; $[4] = t2; }
 *     else { t2 = $[4]; }          // ← `style` never changes, so this wins
 *
 * `_styles2` is rebuilt every render; `_styles2.button` is not re-read. The
 * variant freezes at whatever it resolved to on the render that filled the
 * cache. A button that mounts disabled keeps the disabled opacity after the
 * prop clears; a toast that mounts with no type keeps the default background
 * after it becomes a success. The worst form is a read cached against
 * `Symbol.for("react.memo_cache_sentinel")` — read exactly once, ever.
 *
 * ## The fix at a call site
 *
 * `'use no memo'` as the first statement of the component. The file then
 * behaves as it does without the compiler: `_styles2.button` is re-read every
 * render and the variant is always current. It costs that component's
 * auto-memoization, which is the correct trade for a component whose variants
 * actually move.
 *
 * ## Why a script and not a lint rule
 *
 * The same reason `check-compiler-bailouts.mjs` exists: ESLint reads the
 * original source, and this defect only exists in the output of two Babel
 * plugins composed in a particular order. Compiling is the only way to know.
 *
 *   node scripts/check-unistyles-variant-staleness.mjs           # check
 *   node scripts/check-unistyles-variant-staleness.mjs --update  # re-baseline
 *   node scripts/check-unistyles-variant-staleness.mjs --list    # print findings
 *   node scripts/check-unistyles-variant-staleness.mjs --explain # show the transform
 */
import babel from '@babel/core';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const traverse = _traverse.default ?? _traverse;

const SRC = 'src';
const BASELINE = 'scripts/check-unistyles-variant-staleness.baseline.json';
const UPDATE = process.argv.includes('--update');
const LIST = process.argv.includes('--list');
const EXPLAIN = process.argv.includes('--explain');

const BABEL_OPTIONS = {
  root: process.cwd(),
  babelrc: false,
  configFile: false,
  presets: [
    [
      'module:@react-native/babel-preset',
      { disableImportExportTransform: true },
    ],
  ],
  // The real order from babel.config.js. Reversing it here would not reproduce
  // the defect — that is the whole point.
  plugins: [
    'babel-plugin-react-compiler',
    ['react-native-unistyles/plugin', { root: 'src' }],
  ],
};

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (['__tests__', '__mocks__', 'generated'].includes(entry)) continue;
      sourceFiles(full, out);
    } else if (
      extname(entry) === '.tsx' &&
      !/\.(test|spec)\.tsx$/.test(entry) &&
      readFileSync(full, 'utf8').includes('styles.useVariants')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Style keys that actually declare `variants:` — the only ones that can go stale. */
function variantBearingKeys(source) {
  const keys = new Set();
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  traverse(ast, {
    ObjectProperty(path) {
      const name = path.node.key.name ?? path.node.key.value;
      if (name !== 'variants') return;
      const entry = path.findParent(p => p.isObjectProperty());
      if (entry) keys.add(entry.node.key.name ?? entry.node.key.value);
    },
  });
  return keys;
}

/**
 * Reads of a variant-bearing style that sit inside a compiler cache block whose
 * guard cannot re-run when the variant inputs change.
 */
function staleReads(code, keys) {
  // The temp (or inline object) handed to useVariants. A cache guard mentioning
  // it DOES re-run when the variants move, so it is safe.
  const variantArg = (code.match(/useVariants\((t\d+|\{[^}]*\})\)/) || [])[1];
  const found = new Map();

  const record = (key, why) => {
    if (!keys.has(key)) return;
    if (!found.has(key)) found.set(key, why);
  };

  // Read exactly once, ever.
  for (const m of code.matchAll(
    /\$\[\d+\]===Symbol\.for\("react\.memo_cache_sentinel"\)\)\{([\s\S]{0,500}?)\}else\{/g,
  )) {
    for (const r of m[1].matchAll(/_styles\d+\.([A-Za-z0-9_]+)/g)) {
      record(r[1], 'read once, ever');
    }
  }

  // Cached against values that are not the variant inputs.
  for (const m of code.matchAll(
    /if\((\$\[\d+\][!=]==[^)]*?)\)\{([\s\S]{0,500}?)\}else\{/g,
  )) {
    if (variantArg && m[1].includes(variantArg)) continue;
    for (const r of m[2].matchAll(/_styles\d+\.([A-Za-z0-9_]+)/g)) {
      record(
        r[1],
        `cached on ${m[1].replace(/\$\[\d+\]!==/g, '').slice(0, 60)}`,
      );
    }
  }

  return found;
}

if (EXPLAIN) {
  const DEMO = `
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from 'react-native';
export const Demo = ({ disabled, style }) => {
  styles.useVariants({ disabled });
  return <Pressable style={[styles.button, style]} />;
};
const styles = StyleSheet.create(() => ({
  button: { variants: { disabled: { true: { opacity: 0.4 } } } },
}));
`;
  const render = directive =>
    babel.transformSync(DEMO.replace('=> {', `=> {\n  ${directive}`), {
      ...BABEL_OPTIONS,
      filename: join(process.cwd(), 'src', '__explain__.tsx'),
    }).code;

  console.log(
    'WITHOUT the directive — the variant read is cached on `style`:\n',
  );
  console.log('  ' + (render('').match(/useVariants[\s\S]{0,150}/) || [''])[0]);
  console.log('\nWITH `use no memo` — re-read every render:\n');
  console.log(
    '  ' +
      (render("'use no memo';").match(/useVariants[\s\S]{0,150}/) || [''])[0],
  );
  process.exit(0);
}

const findings = {};
for (const file of sourceFiles(SRC)) {
  const source = readFileSync(file, 'utf8');
  const keys = variantBearingKeys(source);
  if (keys.size === 0) continue;

  let code;
  try {
    code = babel.transformSync(source, {
      ...BABEL_OPTIONS,
      filename: join(process.cwd(), file),
    }).code;
  } catch (error) {
    console.error(`Could not compile ${file}: ${error.message.split('\n')[0]}`);
    process.exitCode = 1;
    continue;
  }

  const stale = staleReads(code, keys);
  if (stale.size > 0) {
    findings[file] = Object.fromEntries(stale);
  }
}

const files = Object.keys(findings).sort();

if (LIST) {
  for (const file of files) {
    console.log(file);
    for (const [key, why] of Object.entries(findings[file])) {
      console.log(`    styles.${key}  —  ${why}`);
    }
  }
  process.exit(0);
}

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      { maxFilesWithStaleVariants: files.length, files },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${files.length} files.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(baseline.files);
const added = files.filter(f => !known.has(f));
const fixed = baseline.files.filter(f => !files.includes(f));

if (added.length > 0) {
  console.error(
    `\n${added.length} component(s) newly at risk of rendering a stale variant:\n`,
  );
  for (const file of added) {
    console.error(`  ${file}`);
    for (const [key, why] of Object.entries(findings[file])) {
      console.error(`      styles.${key}  —  ${why}`);
    }
  }
  console.error(
    '\nAdd `use no memo` as the first statement of the component, with a comment\n' +
      'saying why. Run with --explain to see the transform this defends against.\n',
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(
    `${fixed.length} file(s) fixed since the baseline — run --update:`,
  );
  for (const file of fixed) console.log(`  ${file}`);
}

console.log(
  `Stale-variant risk: ${files.length} file(s), baseline ${baseline.files.length}. OK.`,
);
