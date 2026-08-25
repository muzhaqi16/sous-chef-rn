#!/usr/bin/env node
/**
 * Asserts the startup origin is actually first in Metro's OUTPUT, not just in
 * `index.js`'s source.
 *
 * Metro runs with `experimentalImportSupport: true` (metro.config.js), which
 * rewrites ES imports to `require` calls and hoists every one of them above all
 * top-level statements. Relative order among the requires is preserved; order
 * between a require and a statement is not. So this was true of the shipped
 * bundle:
 *
 *   import 'a';                          require('a');
 *   global.T = Date.now();       ->      require('b');
 *   import 'b';                          global.T = Date.now();
 *
 * `app_startup_duration_ms` and `app_fully_drawn_ms` were therefore measured
 * from a point AFTER i18next init, Apollo config and unistyles registration,
 * while being documented as measuring from JS-bundle entry. Reading the source
 * cannot catch that; this transforms the file and checks the result.
 *
 * Two properties, both load-bearing:
 *   1. The startup-clock module is the FIRST emitted require.
 *   2. It has no imports of its own — an import there would evaluate before its
 *      body and move the origin later again.
 *
 *   node scripts/check-startup-origin.mjs
 *
 * Pinned to Metro internals on purpose: if a Metro upgrade moves this plugin,
 * failing loudly is the intended signal, because the guarantee this checks is a
 * property of that transform.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const CLOCK_MODULE = './src/services/performance/startupClock';
const CLOCK_SOURCE = 'src/services/performance/startupClock.ts';
// Resolved as a file path, not a package subpath: `metro-transform-plugins`
// declares an `exports` map that does not expose `./src/*`.
const PLUGIN_PATH = fileURLToPath(
  new URL(
    '../node_modules/metro-transform-plugins/src/import-export-plugin.js',
    import.meta.url,
  ),
);

let babel;
let plugin;
try {
  babel = require('@babel/core');
  plugin = require(PLUGIN_PATH);
} catch (error) {
  console.error(
    `✗ Could not load the Metro transform used by this check.\n` +
      `  Expected ${PLUGIN_PATH}. A Metro upgrade may have moved it — that is\n` +
      `  worth knowing, because the ordering guarantee is a property of it.\n` +
      `  ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

let output;
try {
  output = babel.transformSync(source, {
    plugins: [
      [
        plugin,
        { importDefault: '_$$_IMPORT_DEFAULT', importAll: '_$$_IMPORT_ALL' },
      ],
    ],
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    filename: 'index.js',
  }).code;
} catch (error) {
  console.error(
    `✗ Could not transform index.js.\n  ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(2);
}

// Every `require('…')` in emitted order.
const required = [...output.matchAll(/require\('([^']+)'\)/g)].map(m => m[1]);

if (required.length === 0) {
  console.error(
    `✗ No requires found in the transformed index.js.\n` +
      `  This check has nothing to assert on and would pass vacuously.`,
  );
  process.exit(2);
}

if (required[0] !== CLOCK_MODULE) {
  console.error(
    `\n✗ The startup origin is not the first module evaluated.\n\n` +
      `  Expected first require: ${CLOCK_MODULE}\n` +
      `  Actual first require:   ${required[0]}\n\n` +
      `  Emitted order:\n` +
      required
        .slice(0, 8)
        .map((m, i) => `    ${i + 1}. ${m}`)
        .join('\n') +
      `\n\n  Everything evaluated before the origin is excluded from\n` +
      `  app_startup_duration_ms and app_fully_drawn_ms while those metrics\n` +
      `  are documented as measuring from JS-bundle entry. Move the\n` +
      `  ${CLOCK_MODULE} import back to the top of index.js.`,
  );
  process.exit(1);
}

// An import in the clock module evaluates before its body, which puts the
// origin after that import — the same defect, one level down.
const clock = readFileSync(
  new URL(`../${CLOCK_SOURCE}`, import.meta.url),
  'utf8',
);
const clockImports = [...clock.matchAll(/^\s*import\s.+$/gm)].map(m =>
  m[0].trim(),
);
if (clockImports.length > 0) {
  console.error(
    `\n✗ ${CLOCK_SOURCE} has imports of its own:\n\n` +
      clockImports.map(i => `    ${i}`).join('\n') +
      `\n\n  A module's imports evaluate before its body, so each of these\n` +
      `  lands before the origin timestamp and is excluded from every metric\n` +
      `  derived from it. Keep this module dependency-free.`,
  );
  process.exit(1);
}

console.log(
  `✓ Startup origin is the first module evaluated (${required.length} requires ` +
    `emitted), and ${CLOCK_SOURCE} is dependency-free.`,
);
