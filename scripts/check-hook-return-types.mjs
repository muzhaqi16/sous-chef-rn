#!/usr/bin/env node
/**
 * Fails when a feature hook's return type names the data library.
 *
 * ## Why this exists
 *
 * `check-data-layer-boundary` keeps the client out of what renders. That is
 * only half the seam: a hook can hold the client correctly and still hand a
 * screen an `ApolloError`, a `NetworkStatus` or a whole result object, which
 * re-couples the screen to the library by its TYPES rather than its imports —
 * and the boundary check cannot see it, because the screen imports nothing.
 *
 * A hook returns plain values and callbacks: booleans for loading and
 * refreshing, a plain error value, named functions. Then swapping the client is
 * a change inside `hooks/`, which is the point of the seam.
 *
 * ## What it reads
 *
 * The real return type, resolved by the TypeScript checker from the app's own
 * tsconfig — not a text search. The type itself and each of its properties one
 * level down, which is where a leak actually shows (`error: ApolloError`).
 *
 *   node scripts/check-hook-return-types.mjs           # check
 *   node scripts/check-hook-return-types.mjs --list    # print every finding
 *   node scripts/check-hook-return-types.mjs --update  # re-baseline
 *   node scripts/check-hook-return-types.mjs --self-test
 */
import { relative } from 'node:path';
import ts from 'typescript';

import {
  baselineFile,
  diffSets,
  filesUnder,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-hook-return-types.baseline.json'),
);

const HOOK_GLOBS = ['src/features/*/hooks/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
];

/**
 * Library types a screen must never be handed. `DocumentNode` is absent: a hook
 * that returns one is passing an operation on to another hook, which stays
 * inside the data layer.
 */
export const BANNED_TYPES = [
  'ApolloError',
  'ApolloClient',
  'ApolloCache',
  'ApolloQueryResult',
  'InMemoryCache',
  'NetworkStatus',
  'ObservableQuery',
  'FetchResult',
  'MutationResult',
  'QueryResult',
  'SubscriptionResult',
];

const BANNED = new RegExp(`\\b(${BANNED_TYPES.join('|')})\\b`);

/** Which banned names a rendered type string mentions. */
export function bannedIn(typeText) {
  return BANNED_TYPES.filter(name =>
    new RegExp(`\\b${name}\\b`).test(typeText),
  );
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['{ loading: boolean; items: Item[] }', []],
    ['{ error: ApolloError | undefined }', ['ApolloError']],
    [
      '{ status: NetworkStatus; q: ObservableQuery<X> }',
      ['NetworkStatus', 'ObservableQuery'],
    ],
    // A name that merely CONTAINS a banned one is not a finding.
    ['{ helper: MyQueryResultAdapter }', []],
  ];
  let failed = false;
  for (const [text, expected] of cases) {
    const got = bannedIn(text);
    if (got.sort().join(',') !== [...expected].sort().join(',')) {
      console.error(
        `✗ Self-test failed for "${text}": expected [${expected}], got [${got}].`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: ${BANNED_TYPES.length} library types are detected in a\n` +
      '  rendered return type, and a name that merely contains one is not.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const hookFiles = filesUnder(HOOK_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: hookFiles.length,
  what: 'feature hook files',
  check: 'check-hook-return-types',
  hint: 'src/features/*/hooks/ moved, or the glob no longer matches',
  minimum: 50,
});

const configPath = fromRoot('tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  REPO_ROOT,
);
const program = ts.createProgram(parsed.fileNames, {
  ...parsed.options,
  noEmit: true,
});
const checker = program.getTypeChecker();

const FORMAT =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType;

/** The type itself plus each property one level down. */
const renderType = (type, node) => {
  const parts = [checker.typeToString(type, node, FORMAT)];
  for (const prop of checker.getPropertiesOfType(type)) {
    const propType = checker.getTypeOfSymbolAtLocation(prop, node);
    parts.push(
      `${prop.getName()}: ${checker.typeToString(propType, node, FORMAT)}`,
    );
  }
  return parts.join('\n');
};

const findings = [];
const hookNames = new Set();

for (const file of hookFiles) {
  const source = program.getSourceFile(file);
  if (!source) continue;
  const rel = relative(REPO_ROOT, file);

  ts.forEachChild(source, node => {
    const isExported = node.modifiers?.some(
      m => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) return;

    /** Declarations that could BE a hook, with the name they are declared as. */
    const declarations = [];
    if (ts.isFunctionDeclaration(node) && node.name) {
      declarations.push([node.name.text, node]);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name))
          declarations.push([decl.name.text, decl]);
      }
    }

    for (const [name, decl] of declarations) {
      if (!/^use[A-Z]/.test(name)) continue;
      const symbol = checker.getSymbolAtLocation(
        ts.isFunctionDeclaration(decl) ? decl.name : decl.name,
      );
      if (!symbol) continue;
      const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
      const signatures = type.getCallSignatures();
      if (signatures.length === 0) continue;

      hookNames.add(`${rel}::${name}`);
      const returnType = checker.getReturnTypeOfSignature(signatures[0]);
      const rendered = renderType(returnType, decl);
      if (!BANNED.test(rendered)) continue;
      for (const banned of bannedIn(rendered)) {
        findings.push(`${banned}::${rel}::${name}`);
      }
    }
  });
}

requireNonEmptyScan({
  count: hookNames.size,
  what: 'exported hooks',
  check: 'check-hook-return-types',
  hint: 'the program resolved no call signatures — check tsconfig parsing',
  minimum: 50,
});

const current = [...new Set(findings)].sort();

if (flags.list) {
  for (const entry of current) {
    const [banned, rel, name] = entry.split('::');
    console.log(`${banned.padEnd(20)} ${name}  (${rel})`);
  }
  console.log(
    `\n${current.length} leak(s) across ${hookNames.size} exported hooks in ` +
      `${hookFiles.length} files.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().leaks ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-hook-return-types',
  });
  BASELINE.write({
    leaks: current,
    scannedHooks: hookNames.size,
    scannedFiles: hookFiles.length,
  });
  console.log(
    `Recorded ${current.length} leak(s) across ${hookNames.size} exported hooks.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-hook-return-types');
const { added, removed } = diffSets(current, baseline.leaks ?? []);

if (added.length) {
  console.error(
    `\n✗ check-hook-return-types: ${added.length} feature hook return type(s) name the data library.\n`,
  );
  for (const entry of added) {
    const [banned, rel, name] = entry.split('::');
    console.error(`    ${banned.padEnd(20)} ${name}  (${rel})`);
  }
  console.error(
    `\n  A hook returns plain values and callbacks — a boolean for loading, a\n` +
      `  plain error value, named functions. Handing a screen a library type\n` +
      `  re-couples it by its TYPES, which the import-based boundary check\n` +
      `  cannot see.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-hook-return-types: ${removed.length} baselined leak(s) are gone.\n`,
  );
  for (const entry of removed)
    console.error(`    ${entry.split('::').join('  ')}`);
  console.error(
    `\n  Record it: node scripts/check-hook-return-types.mjs --update\n`,
  );
  process.exit(1);
}

console.log(
  `check-hook-return-types: ${current.length} leak(s) across ${hookNames.size} ` +
    `exported hooks, baseline ${baseline.leaks?.length ?? 0}.`,
);
