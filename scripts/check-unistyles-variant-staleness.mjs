/**
 * Fails when more components can render a STALE `styles.useVariants(...)` value
 * than the recorded baseline allows.
 *
 * ## The mechanism
 *
 * The Unistyles plugin rewrites
 *
 *     styles.useVariants({ disabled });
 *     return <Pressable style={[styles.button, style]} />;
 *
 * into a shadowed local carrying the resolved variants. If the compiler cannot
 * see that local as a dependency, it caches the style read against the OTHER
 * values in the expression:
 *
 *     if ($[3] !== style) { t2 = [_styles2.button, style]; $[4] = t2; }
 *     else { t2 = $[4]; }          // `style` never changes, so this wins
 *
 * The shadow is rebuilt every render; the read off it is not. The variant then
 * freezes at whatever it resolved to on the render that filled the cache. The
 * worst form is a read cached against `Symbol.for("react.memo_cache_sentinel")`
 * — read exactly once, ever.
 *
 * `scripts/babel/unistyles-scope-crawl.js` is what keeps the read in the cache
 * key, so the baseline is empty and a finding here is a regression: something
 * defeated that, most likely the plugin order in `babel.config.js` or a shape
 * the guard-aware check below does not recognise. Read the compiled output
 * before acting, and check `node scripts/probe-unistyles-compiler-order.mjs`.
 *
 * `'use no memo'` is not the answer — it buys correctness by giving up that
 * component's memoization, and the opt-out ratchet in
 * `check-compiler-bailouts.mjs` is empty on purpose.
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
import { join, extname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import {
  requireNonEmptyScan,
  refuseEmptyBaselineUpdate,
} from './lib/guardScan.mjs';

const traverse = _traverse.default ?? _traverse;

// Resolved from this file, not the cwd — every sibling check does the same, and
// a cwd-relative 'src' silently scanned nothing when run from anywhere else.
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(REPO_ROOT, 'src');
const BASELINE = join(
  REPO_ROOT,
  'scripts/check-unistyles-variant-staleness.baseline.json',
);

/**
 * Any stylesheet identifier, not the literal `styles`.
 *
 * Matching `styles.useVariants` as a lowercase substring made whole files
 * invisible: `indicatorStyles.useVariants(...)` in AddDetailsSheet.tsx never
 * matched, and that file carried the worst form of this defect — the page
 * indicator's dot read once against `react.memo_cache_sentinel`, so the current
 * page never highlighted. Six call sites name their stylesheet something other
 * than `styles`, deliberately: a file with two stylesheets has to.
 */
const USE_VARIANTS_CALL = /\b([A-Za-z_$][\w$]*)\.useVariants\s*\(/;
const UPDATE = process.argv.includes('--update');
const LIST = process.argv.includes('--list');
const EXPLAIN = process.argv.includes('--explain');

// Resolved to absolute paths from THIS file. Babel resolves bare plugin names
// against the cwd, so a bare name made the whole scan fail — every file
// "could not compile" — when the script ran from anywhere but the repo root.
const resolveFromRepo = createRequire(import.meta.url).resolve;

const BABEL_OPTIONS = {
  root: REPO_ROOT,
  babelrc: false,
  configFile: false,
  presets: [
    [
      resolveFromRepo('@react-native/babel-preset'),
      { disableImportExportTransform: true },
    ],
  ],
  // The real order from babel.config.js, scope-crawl included. This has to
  // track that file: a scan that compiles a plugin order the app does not ship
  // reports on a configuration nobody runs.
  plugins: [
    [resolveFromRepo('react-native-unistyles/plugin'), { root: 'src' }],
    join(REPO_ROOT, 'scripts/babel/unistyles-scope-crawl.js'),
    resolveFromRepo('babel-plugin-react-compiler'),
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
      USE_VARIANTS_CALL.test(readFileSync(full, 'utf8'))
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Style keys that actually declare `variants:` — the only ones that can go
 * stale — as `"<stylesheet>.<key>"` pairs.
 *
 * Qualified by the stylesheet they belong to, because key names are NOT unique
 * within a file. `NutritionSummary.tsx` declares `container` in both `styles`
 * and `circleStyles`, and `PageIndicator.tsx` declares `label` twice; matching
 * on the bare key made a correctly-guarded read of one satisfy the other, and
 * both files sat in the baseline as false positives because of it.
 */
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
      if (!entry) return;
      const key = entry.node.key.name ?? entry.node.key.value;
      // The `const <name> = StyleSheet.create(...)` this entry lives in.
      const decl = entry.findParent(p => p.isVariableDeclarator());
      const sheet = decl?.node.id?.name;
      if (sheet) keys.add(`${sheet}.${key}`);
    },
  });
  return keys;
}

/**
 * `circleStyles$0` / `_circleStyles2` → `circleStyles`.
 *
 * Both plugin orders rename the shadowed stylesheet, and the suffix differs
 * between them, so the local in the compiled output has to be mapped back to
 * the source stylesheet name before it can be matched against the pairs above.
 */
function sheetOf(local) {
  return local.replace(/^_/, '').replace(/(\$\d+|\d+)$/, '');
}

/**
 * Reads of a variant-bearing style that sit inside a compiler cache block whose
 * guard cannot re-run when the variant inputs change.
 */
function staleReads(code, keys) {
  // The temp (or inline object) handed to useVariants. A cache guard mentioning
  // it DOES re-run when the variants move, so it is safe.
  // EVERY `useVariants` argument in the file, not just the first. A file may
  // hold several stylesheets — NutritionSummary.tsx has `circleStyles`,
  // `badgeStyles` and `styles`, each with its own call — and exempting guards
  // against only the first call's temp reports the other two as stale.
  const variantArgs = Array.from(
    code.matchAll(/useVariants\((t\d+|\{[^}]*\})\)/g),
    m => m[1],
  );
  const found = new Map();

  // Any `<local>.<key>` read, not a particular local NAME. The shadow's name is
  // an artifact of the plugin order: `_styles2` when the compiler ran first,
  // `styles$0` now that Unistyles runs first and the scope is re-crawled. A
  // pattern anchored to `_<name><digits>` matches nothing under the current
  // order, so the scan would find zero and report a confident all-clear —
  // exactly the failure a staleness check must not have. `keys` is what makes
  // this specific: only variant-bearing style keys are ever recorded.
  const STYLE_READ = /\b([A-Za-z_$][\w$]*)\.([A-Za-z0-9_]+)/g;

  // `<stylesheet>.<key>`, the same shape `variantBearingKeys` produces.
  const pair = m => `${sheetOf(m[1])}.${m[2]}`;

  // Every style read the compiler tracks as a cache DEPENDENCY anywhere in the
  // file. Such a read is re-taken whenever the variant resolves to a different
  // object, so it cannot be stale — and the cache blocks nest, so a read that
  // its own guard protects is routinely swept up by the fixed-width window of
  // an OUTER guard that does not mention it. Collecting dependencies file-wide
  // is what stops that nesting from reporting a fresh read as frozen.
  const trackedAsDependency = new Set();
  for (const g of code.matchAll(/if\((\$\[\d+\][!=]==[^)]*?)\)\{/g)) {
    for (const r of g[1].matchAll(new RegExp(STYLE_READ.source, 'g'))) {
      trackedAsDependency.add(pair(r));
    }
  }

  const record = (key, why) => {
    if (!keys.has(key)) return;
    if (trackedAsDependency.has(key)) return;
    if (!found.has(key)) found.set(key, why);
  };

  // Read exactly once, ever.
  for (const m of code.matchAll(
    /\$\[\d+\]===Symbol\.for\("react\.memo_cache_sentinel"\)\)\{([\s\S]{0,500}?)\}else\{/g,
  )) {
    for (const r of m[1].matchAll(new RegExp(STYLE_READ.source, 'g'))) {
      record(pair(r), 'read once, ever');
    }
  }

  // Cached against values that are not the variant inputs.
  for (const m of code.matchAll(
    /if\((\$\[\d+\][!=]==[^)]*?)\)\{([\s\S]{0,500}?)\}else\{/g,
  )) {
    if (variantArgs.some(arg => m[1].includes(arg))) continue;
    // A guard that tests the style read itself is FRESH, not stale: the cache
    // is invalidated whenever the variant resolves to a different object. That
    // is what the corrected plugin order produces —
    // `if ($[2] !== style || $[3] !== styles$0.button)` — so without this the
    // check would flag the very shape it exists to ask for.
    const guarded = new Set(
      Array.from(m[1].matchAll(new RegExp(STYLE_READ.source, 'g')), pair),
    );
    for (const r of m[2].matchAll(new RegExp(STYLE_READ.source, 'g'))) {
      if (guarded.has(pair(r))) continue;
      record(
        pair(r),
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

const scanned = sourceFiles(SRC);

// A preset upgrade, a rename, or a moved directory can leave this scan matching
// nothing — and a scan that matched nothing prints exactly what a clean tree
// prints. Fail instead. The floor is the baseline's own size: this check has
// never legitimately collapsed from 50 files to a handful in one change.
const baselineForFloor = JSON.parse(readFileSync(BASELINE, 'utf8'));
requireNonEmptyScan({
  count: scanned.length,
  what: 'source files calling `.useVariants(...)`',
  check: 'check-unistyles-variant-staleness',
  minimum: Math.max(1, Math.floor(baselineForFloor.files.length * 0.5)),
  hint:
    'the Unistyles babel plugin changed its output shape, or `src/` moved. ' +
    'Run with --explain to see the transform this depends on.',
});

const findings = {};
let compileFailures = 0;
for (const file of scanned) {
  const source = readFileSync(file, 'utf8');
  const keys = variantBearingKeys(source);
  if (keys.size === 0) continue;

  let code;
  try {
    code = babel.transformSync(source, {
      ...BABEL_OPTIONS,
      filename: file,
    }).code;
  } catch (error) {
    console.error(`Could not compile ${file}: ${error.message.split('\n')[0]}`);
    process.exitCode = 1;
    compileFailures++;
    continue;
  }

  const stale = staleReads(code, keys);
  if (stale.size > 0) {
    findings[file] = Object.fromEntries(stale);
  }
}

// A file that would not compile was not examined. Enough of them and the run
// has the same standing as an empty scan — it must not go on to report zero
// findings as a clean result, nor invite a re-baseline from it.
if (compileFailures > scanned.length / 4) {
  console.error(
    `\n✗ ${compileFailures} of ${scanned.length} files failed to compile, so ` +
      `this check did not examine them.\n` +
      `  Reporting a result from the remainder would understate the risk.\n`,
  );
  process.exit(2);
}

// Recorded repo-relative so the baseline does not depend on where the repo is
// checked out.
const files = Object.keys(findings)
  .map(f => relative(REPO_ROOT, f))
  .sort();

if (LIST) {
  for (const file of files) {
    console.log(file);
    for (const [key, why] of Object.entries(findings[join(REPO_ROOT, file)])) {
      console.log(`    ${key}  —  ${why}`);
    }
  }
  // NOT `process.exit(0)`: a file that failed to compile above set
  // `process.exitCode = 1`, and exiting explicitly would discard it.
  process.exit(process.exitCode ?? 0);
}

if (UPDATE) {
  refuseEmptyBaselineUpdate({
    count: files.length,
    baselineCount: baselineForFloor.files.length,
    check: 'check-unistyles-variant-staleness',
  });
  writeFileSync(
    BASELINE,
    JSON.stringify(
      // `files` only. A `maxFilesWithStaleVariants` count used to be written
      // beside it and was never read by anything — enforcement is entirely
      // set-membership over `files`, so the number was decoration that looked
      // like a limit.
      { files },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${files.length} files.`);
  process.exit(0);
}

const baseline = baselineForFloor;
const known = new Set(baseline.files);
const added = files.filter(f => !known.has(f));
const fixed = baseline.files.filter(f => !files.includes(f));

if (added.length > 0) {
  console.error(
    `\n${added.length} component(s) newly at risk of rendering a stale variant:\n`,
  );
  for (const file of added) {
    console.error(`  ${file}`);
    for (const [key, why] of Object.entries(findings[join(REPO_ROOT, file)])) {
      console.error(`      ${key}  —  ${why}`);
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
