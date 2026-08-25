#!/usr/bin/env node
/**
 * Generates `src/config/env.generated.ts` from the active env file (+ process.env).
 *
 * Source of truth at build time:
 *   - Local/dev/test: a `.env` (or `.env.<name>` via ENVFILE) file in the repo root.
 *   - CI: the workflow writes `.env` (iOS) / `.env.<BUILD_ENV>` (Android) from
 *     GitHub vars/secrets, then runs this script before bundling.
 *
 * `process.env` always wins over the file, so values exported directly into the
 * build environment (CI `env:` blocks) override the file. Missing values become
 * `undefined` — the script never fails, so typecheck/PR-checks work without a
 * populated env file.
 *
 * Replaces react-native-config: the output is plain TypeScript, so the app reads
 * config as pure JS with no native module.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Keys the app consumes. Anything not listed here is ignored (and stripped from
// the bundle), which keeps unrelated shell vars out of the generated output.
const KEYS = [
  'NODE_ENV',
  'API_URL',
  'WEB_SOCKET_URL',
  'API_KEY',
  'WEB_APP_URL',
  'GRAPHQL_BATCH_ENABLED',
  'SPOONACULAR_API_KEY',
  'OTLP_METRICS_ENDPOINT',
  'OTLP_METRICS_AUTH_USERNAME',
  'OTLP_METRICS_AUTH_PASSWORD',
  'OTLP_LOGS_ENDPOINT',
  'OTLP_LOGS_AUTH_USERNAME',
  'OTLP_LOGS_AUTH_PASSWORD',
  // Environment-specific URL overrides read by Environment.getApiConfig()
  'DEV_API_URL',
  'DEV_WS_URL',
  'STAGING_API_URL',
  'STAGING_WS_URL',
  'PROD_API_URL',
  'PROD_WS_URL',
  'ENABLE_DEBUG_LOGS',
  'ENABLE_PRODUCTION_LOGS',
  // Build identity. Without these a measurement cannot be traced to the code
  // that produced it, which is what made a whole performance investigation
  // unattributable (see docs/audits/perf-offline-baseline-2026-08-24.md).
  // GIT_SHA falls back to the working tree's HEAD, so local builds are
  // attributable too; CI overrides both via `process.env`.
  'GIT_SHA',
  'BUILD_ID',
];

/**
 * HEAD's short SHA, with `-dirty` when the tree has uncommitted changes — a
 * number measured against a dirty tree is not reproducible and should say so.
 * Returns undefined outside a git checkout rather than failing the build.
 */
function gitSha() {
  const run = args =>
    execFileSync('git', args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  let sha;
  try {
    sha = run(['rev-parse', '--short', 'HEAD']);
  } catch {
    return undefined;
  }
  let dirty = '';
  try {
    if (run(['status', '--porcelain'])) dirty = '-dirty';
  } catch {
    // A status failure says nothing about the SHA; report it unqualified.
  }
  return `${sha}${dirty}`;
}

const repoRoot = path.resolve(__dirname, '..');

/**
 * Decide which env file to read. Precedence:
 *  1. ENVFILE — explicit (npm scripts like `ios:stg`, CI). Always wins.
 *  2. /tmp/envfile — written by the Xcode scheme's "Set Environment" pre-action
 *     so the dropdown picks the env file for release/archive bundles. Only
 *     trusted inside an Xcode build (CONFIGURATION is set there, never for the
 *     Metro dev server), so a stale temp file can't leak into `npm start`.
 *  3. `.env` — local/dev default.
 */
function resolveEnvFileName() {
  if (process.env.ENVFILE) return process.env.ENVFILE;
  if (process.env.CONFIGURATION && fs.existsSync('/tmp/envfile')) {
    const fromScheme = fs.readFileSync('/tmp/envfile', 'utf8').trim();
    if (fromScheme) return fromScheme;
  }
  return '.env';
}

/** Minimal .env parser (KEY=VALUE lines; ignores comments/blanks; strips quotes). */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function generateEnv() {
  const envFileName = resolveEnvFileName();
  const envFilePath = path.join(repoRoot, envFileName);
  const fileValues = parseEnvFile(envFilePath);
  // process.env wins over the file so CI `env:` overrides take precedence.
  const resolve = key => {
    const value = process.env[key] ?? fileValues[key];
    if (value !== undefined) return value;
    // Derived last, so an explicit CI value always wins.
    return key === 'GIT_SHA' ? gitSha() : undefined;
  };

  const entries = KEYS.map(key => {
    const value = resolve(key);
    return `  ${key}: ${
      value === undefined ? 'undefined' : JSON.stringify(value)
    },`;
  }).join('\n');

  const source = fs.existsSync(envFilePath)
    ? envFileName
    : '(no env file; process.env only)';
  const output = `// AUTO-GENERATED by scripts/generate-env.js — DO NOT EDIT or commit.
// Source: ${source}

export interface GeneratedEnv {
${KEYS.map(k => `  ${k}?: string;`).join('\n')}
}

export const RAW_ENV: GeneratedEnv = {
${entries}
};
`;

  const outDir = path.join(repoRoot, 'src', 'config');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'env.generated.ts'), output);

  const present = KEYS.filter(k => resolve(k) !== undefined).length;
  console.log(
    `[generate-env] wrote src/config/env.generated.ts (${present}/${
      KEYS.length
    } keys from ${fs.existsSync(envFilePath) ? envFileName : 'process.env'})`,
  );
}

module.exports = { generateEnv };

// Run when invoked directly (npm scripts, CI), not when required by metro.config.
if (require.main === module) {
  generateEnv();
}
