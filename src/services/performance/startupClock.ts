/**
 * The origin every startup metric is measured from. MUST HAVE NO IMPORTS and
 * must be `index.js`'s first import: Metro hoists every `require` above top-level
 * statements, so only a dependency-free first require evaluates first. An import
 * here silently moves the origin later; `scripts/check-startup-origin.mjs` holds it.
 */

// A global, not a local: the value must outlive this module for
// `NativePerformanceService` to read, without an import that would defeat the above.
(globalThis as { __APP_START_TIMESTAMP?: number }).__APP_START_TIMESTAMP =
  Date.now();

export {};
