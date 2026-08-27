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
  // unattributable — every reading had to be retracted.
  // GIT_SHA falls back to the working tree's HEAD, so local builds are
  // attributable too; CI overrides both via `process.env`.
  'GIT_SHA',
  'BUILD_ID',
  // Opt-in Hermes startup CPU profiling. Off unless explicitly set, because a
  // profiled run's timings are NOT comparable to an unprofiled one's.
  'HERMES_PROFILE_STARTUP',
  // Whether this build will accept an auth state handed to it through launch
  // arguments. Off unless a build explicitly asks for it. Read the block above
  // `allowsLaunchArgAuth` in src/utils/environment.ts before setting it.
  'ALLOW_LAUNCH_ARG_AUTH',
];

/**
 * HEAD's short SHA, with `-dirty` when the tree has uncommitted changes — a
 * number measured against a dirty tree is not reproducible and should say so.
 * Returns undefined outside a git checkout rather than failing the build.
 */
let cachedGitSha;
function gitSha() {
  // Memoized: `resolve()` runs twice per key by design (once to build the
  // output, once for the "N/M keys" count), and `generateEnv()` itself runs on
  // every Metro start and every build step. Unmemoized that is four git
  // subprocesses per invocation, one of them a full-worktree `git status`.
  if (cachedGitSha !== undefined) return cachedGitSha || undefined;
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
    // Cache the miss too, so a non-checkout build does not retry per call.
    cachedGitSha = '';
    return undefined;
  }
  let dirty = '';
  try {
    if (run(['status', '--porcelain'])) dirty = '-dirty';
  } catch {
    // A status failure says nothing about the SHA; report it unqualified.
  }
  cachedGitSha = `${sha}${dirty}`;
  return cachedGitSha;
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

/**
 * Build identity recorded in a previously generated `env.generated.ts`, kept
 * only where re-deriving it now would be a DOWNGRADE.
 *
 * Metro calls `generateEnv()` at module scope, so the file is rewritten on
 * every Metro start and every bundling step — often from a process that has
 * neither variable. Two downgrades are possible and both shipped:
 *
 *   - BUILD_ID has no derivation at all, so it simply became `undefined`.
 *   - GIT_SHA fell back to `gitSha()`, replacing CI's full sha with a short,
 *     `-dirty`-suffixed one.
 *
 * Deliberately NOT a blanket "keep whatever was there": that would freeze a
 * local checkout's sha at its first value and stop `-dirty` from ever tracking
 * the tree again — which is exactly what the precision test that used to guard
 * this did, because it could never be false. Only these two keys, and GIT_SHA
 * only when this tree can derive no sha at all.
 */
function readExistingBuildIdentity() {
  const generatedPath = path.join(
    repoRoot,
    'src',
    'config',
    'env.generated.ts',
  );
  if (!fs.existsSync(generatedPath)) return {};
  let source;
  try {
    source = fs.readFileSync(generatedPath, 'utf8');
  } catch {
    return {};
  }

  const read = key => {
    const match = source.match(new RegExp(`^  ${key}: "([^"]*)",$`, 'm'));
    return match ? match[1] : undefined;
  };

  const identity = {};
  // Never derived, so a recorded value can only have come from an explicit
  // source. Losing it is always a downgrade.
  const buildId = read('BUILD_ID');
  if (buildId) identity.BUILD_ID = buildId;

  // Kept ONLY when this tree cannot describe itself at all.
  //
  // The condition here used to be `!FULL_SHA.test(gitSha() ?? '')`, which is
  // unconditionally TRUE: `gitSha()` only ever returns a SHORT sha, so it never
  // matches FULL_SHA and the recorded value was preserved on every subsequent
  // run. One `GIT_SHA=$(git rev-parse HEAD) npm run ios:release` therefore
  // pinned every later local build to that commit — `-dirty` never reappeared,
  // and `check-build-provenance.mjs` did not notice because it only compares
  // when `process.env.GIT_SHA` is set. That defeats the traceability the value
  // exists for: the build reports a commit it was not built from.
  //
  // A tree that CAN derive a sha always wins, precise or not: describing the
  // wrong commit is worse than describing this one less precisely.
  const recordedSha = read('GIT_SHA');
  if (recordedSha && !gitSha()) {
    identity.GIT_SHA = recordedSha;
  }

  return identity;
}

function generateEnv() {
  const envFileName = resolveEnvFileName();
  const envFilePath = path.join(repoRoot, envFileName);
  const fileValues = parseEnvFile(envFilePath);
  // process.env wins over the file so CI `env:` overrides take precedence.
  // Build identity already written by an earlier run of this script. Metro
  // calls generateEnv() at module scope on every start and every bundling
  // step, often in a process that has neither variable — so without this, the
  // second run replaced a 40-char CI sha with `gitSha()`'s short `-dirty` one
  // and BUILD_ID with `undefined`, minutes after CI set them correctly.
  const existing = readExistingBuildIdentity();

  const resolve = key => {
    const value = process.env[key] ?? fileValues[key];
    if (value !== undefined) return value;
    // Never downgrade a recorded identity to a weaker derived one.
    if (existing[key] !== undefined) return existing[key];
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

// `KEYS` is exported for `check-bundled-secrets.mjs`, which derives its
// candidate set from it. Exporting the array — rather than having the checker
// parse this file — keeps one source of truth without making the gate's
// coverage depend on the punctuation of the comments above.
module.exports = { generateEnv, KEYS };

// Run when invoked directly (npm scripts, CI), not when required by metro.config.
if (require.main === module) {
  generateEnv();
}
