/**
 * The origin every startup metric is measured from.
 *
 * THIS MODULE MUST HAVE NO IMPORTS, and must be `index.js`'s first import.
 *
 * Both halves of that are load-bearing. Metro runs with
 * `experimentalImportSupport: true` (metro.config.js), which hoists every
 * `require` above all top-level statements while preserving the relative order
 * of the requires themselves. A timestamp written as a statement in `index.js`
 * therefore runs AFTER every module `index.js` imports — including
 * `./src/i18n/config`, `./src/apollo/config` and `./src/theme/unistyles` — no
 * matter how near the top of the file it appears.
 *
 * A first-position require with no dependencies of its own is the one shape
 * that does evaluate first. Adding an import to this file silently moves the
 * origin later and understates every metric derived from it, so
 * `scripts/check-startup-origin.mjs` asserts both properties against Metro's
 * transformed output rather than against the source.
 */

// Not `Date.now()` captured into a local: the value has to outlive this module
// for `NativePerformanceService` to read, and a global is what survives Metro's
// module boundaries without an import that would defeat the point above.
(globalThis as { __APP_START_TIMESTAMP?: number }).__APP_START_TIMESTAMP =
  Date.now();

export {};
