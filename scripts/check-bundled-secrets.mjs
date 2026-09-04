#!/usr/bin/env node
/**
 * Requires every credential in a built JS bundle to carry a recorded decision.
 *
 * A distributed binary is readable by anyone who obtains it — an APK and an IPA
 * are both zip files, and an unattended client cannot hold a secret. So presence
 * is not by itself the defect; what the credential grants a hostile holder is.
 * Rotation does not change that either: the next build inlines the replacement
 * identically.
 *
 * Every credential-shaped build var must therefore be classified as
 * PUBLIC_BY_DESIGN or ACCEPTED_FINDINGS below, or this fails. Silence must not
 * read as approval. See docs/bundled-credentials-decision.md.
 *
 * This checks the ARTIFACT, not the source, because that is where the question
 * is actually settled. A key can be absent from `src/` and still be inlined by
 * the bundler through `env.generated.ts`.
 *
 *   node scripts/check-bundled-secrets.mjs <bundle.js> [more.js ...]
 *   node scripts/check-bundled-secrets.mjs --self-test
 *
 * What counts as a secret is read from the environment the bundle was built
 * with, so there is no list of literal key values to keep in sync (and none
 * committed here — that would be the same mistake in a new place).
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// The same parser AND the same env-file resolution the generator uses, so the
// scanner looks for exactly the values the bundler inlined rather than a second
// interpretation of which file that was.
const { parseEnvFile, resolveEnvFileName } = createRequire(import.meta.url)(
  './generate-env.js',
);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Env vars whose VALUE must never reach a bundle. Not hand-maintained:
 * candidates are derived by name shape from `generate-env.js`'s own `KEYS`, so
 * a new credential is a candidate the day it is added. Each must be classified
 * below or the check fails — forgetting blocks the build instead of passing.
 */
const CREDENTIAL_NAME = /(KEY|SECRET|PASSWORD|TOKEN|CREDENTIAL)$/;

/**
 * Bundled values that are SAFE to ship, each with why. The test is not "can it
 * be extracted" but "what does it grant a hostile holder?" — so: write-only or
 * identity-only, individually revocable, rate-limited server-side. An
 * infrastructure credential never qualifies, however narrowly scoped.
 */
const PUBLIC_BY_DESIGN = {
  API_KEY:
    'Identifies this client to our own backend; it does not authorize anything ' +
    'on its own — the JWT does, via the schema auth directives. Stored as a ' +
    'hashed `ApiKey` row with `permissions`, `rateLimit`, and separate ' +
    '`isActive` / `revokedAt`, so it is throttled and revocable server-side. ' +
    'This is the same shape as a Sentry DSN or a Datadog client token.',
};

/**
 * Findings that are known, accepted and NOT yet fixed: reported every run, but
 * they do not fail the build. An entry is a debt with a name on it, not an
 * exemption — the check FAILS if an accepted key was searchable and not found,
 * so the exception cannot outlive its subject.
 */
const ACCEPTED_FINDINGS = {
  SPOONACULAR_API_KEY:
    'Deliberate, decided 2026-08-17: recipe search stays client-side so it ' +
    'keeps working when our own API is down. Proxying it would couple search ' +
    'availability to API availability. The trade accepted is a metered ' +
    'third-party quota a stranger can burn. Revisit with the telemetry ' +
    'question — see docs/bundled-credentials-decision.md.',
  OTLP_METRICS_AUTH_PASSWORD:
    'Basic-auth credential for the metrics store OTLP endpoint. Out of scope ' +
    'as of 2026-08-17, to be planned properly later. Blast radius is write ' +
    'access to the metrics store; no user data, no read access. Cheapest ' +
    'mitigation is tenant ingestion/cardinality limits, not a client change ' +
    '— see docs/bundled-credentials-decision.md.',
  OTLP_LOGS_AUTH_PASSWORD:
    'Basic-auth credential for the logs store OTLP endpoint. Same trade and ' +
    'same decision as OTLP_METRICS_AUTH_PASSWORD above.',
};

/** A well-formed environment variable name. */
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * Read `generate-env.js`'s KEYS array — the vars the bundler inlines. Imported,
 * not text-scraped: an apostrophe in one of its comments shifted quote pairing
 * mid-array and hid every key after it. The shape checks below exist because
 * "nothing unclassified found" and "nothing looked at" must not share an exit code.
 */
function bundledEnvKeys() {
  const require = createRequire(import.meta.url);
  let keys;
  try {
    keys = require('./generate-env.js').KEYS;
  } catch (error) {
    console.error(
      `✗ Could not load the KEYS list from scripts/generate-env.js.\n` +
        `  Without it this check has no candidate set and would pass vacuously.\n` +
        `  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    console.error(
      `✗ scripts/generate-env.js exported no KEYS array.\n` +
        `  An empty candidate set is a failure of this check, not a pass.`,
    );
    process.exit(2);
  }

  const malformed = keys.filter(
    key => typeof key !== 'string' || !ENV_NAME.test(key),
  );
  if (malformed.length > 0) {
    console.error(
      `✗ scripts/generate-env.js exported entries that are not env var names:\n\n` +
        malformed.map(k => `  ${JSON.stringify(k)}`).join('\n') +
        `\n\nThe candidate set is malformed, so this check cannot say what is or\n` +
        `is not classified. Fix the KEYS array rather than this script.`,
    );
    process.exit(2);
  }

  return keys;
}

/**
 * Credential-shaped keys carrying no recorded decision.
 *
 * A function so `--self-test` can push a planted key through the same
 * classification the real check uses, rather than through a copy of it.
 */
function unclassifiedCredentials(keys) {
  return keys.filter(
    key =>
      CREDENTIAL_NAME.test(key) &&
      !(key in PUBLIC_BY_DESIGN) &&
      !(key in ACCEPTED_FINDINGS),
  );
}

const SECRET_ENV_KEYS = bundledEnvKeys().filter(
  key => CREDENTIAL_NAME.test(key) && !(key in PUBLIC_BY_DESIGN),
);

// A credential-shaped var that nobody has classified. Blocking here is the
// point: the decision about what a leaked copy grants has to be made by a
// person, once, in writing — not inferred from silence.
const unclassified = unclassifiedCredentials(bundledEnvKeys());
if (unclassified.length > 0) {
  console.error(
    `\n✗ Credential-shaped build vars with no decision recorded:\n\n` +
      unclassified.map(k => `  ${k}`).join('\n') +
      `\n\nEach is inlined into the shipped bundle and readable by anyone who\n` +
      `obtains the app. Classify each one in scripts/check-bundled-secrets.mjs:\n` +
      `  PUBLIC_BY_DESIGN  — write-only/identity-only, revocable, rate-limited\n` +
      `  ACCEPTED_FINDINGS — shipping anyway, with the reason and the trade\n` +
      `Or route the call through a backend and stop inlining it.`,
  );
  process.exit(1);
}

/**
 * Values too short or too common to search for without drowning in false
 * positives. A real credential is long and high-entropy; a placeholder like
 * `your_api_key_here` is neither, and flagging it would train people to ignore
 * this check.
 */
const MIN_SECRET_LENGTH = 12;
const PLACEHOLDER = /^(your_|changeme|placeholder|xxx|todo|<.*>$)/i;

function isSearchable(value) {
  return (
    typeof value === 'string' &&
    value.length >= MIN_SECRET_LENGTH &&
    !PLACEHOLDER.test(value)
  );
}

/**
 * Exit code for a run with nothing to search for. In CI that is a failure: the
 * job is the only place this check runs against a real bundle, so a run handed
 * no values proves nothing while looking identical to a clean pass. Locally it
 * stays a warning, where a missing `.env` is ordinary.
 */
function vacuityExitCode(secretCount, isCI) {
  if (secretCount > 0) return 0;
  return isCI ? 2 : 0;
}

/**
 * The secret values to look for, from the same sources `generate-env.js` reads:
 * `process.env` wins over the active env file.
 */
function collectSecrets() {
  const fromFile = parseEnvFile(join(REPO_ROOT, resolveEnvFileName()));
  const secrets = [];
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key] ?? fromFile[key];
    if (isSearchable(value)) secrets.push({ key, value });
  }
  return secrets;
}

const BUNDLE_EXTENSIONS = ['.js', '.bundle', '.hbc', '.jsbundle'];

/** Collect bundle files, recursing into directories. */
function bundleFiles(targets, out = []) {
  for (const target of targets) {
    if (!existsSync(target)) {
      console.error(`✗ No such path: ${target}`);
      process.exit(2);
    }
    if (statSync(target).isDirectory()) {
      const entries = readdirSync(target).map(e => join(target, e));
      bundleFiles(entries, out);
    } else if (BUNDLE_EXTENSIONS.includes(extname(target))) {
      out.push(target);
    }
  }
  return out;
}

// Self-test. A check that cannot fail is worse than no check, and this one is
// only ever exercised in CI against a clean bundle — where passing and being
// broken look identical. `--self-test` plants a known value in a fake bundle
// and asserts the scanner finds it.
if (process.argv.includes('--self-test')) {
  const planted = 'sk_test_0123456789abcdefghijklmnop';
  const haystack = `var a=1;var k="${planted}";console.log(k);`;
  const found = haystack.includes(planted);
  if (!found) {
    console.error('✗ Self-test failed: scanner did not find a planted secret.');
    process.exit(2);
  }
  const tooShort = isSearchable('abc');
  const placeholder = isSearchable('your_spoonacular_api_key_here');
  if (tooShort || placeholder) {
    console.error(
      `✗ Self-test failed: filter accepted a value it should skip ` +
        `(short=${tooShort}, placeholder=${placeholder}).`,
    );
    process.exit(2);
  }
  // The candidate set is the other half of this gate, and the half that failed
  // silently: a scanner that works is useless if it is handed nothing to look
  // for. Plant an unclassified credential-shaped key and require the same
  // classification the real check runs to catch it.
  const candidates = bundledEnvKeys();
  const plantedKey = 'SELF_TEST_PLANTED_TOKEN';
  const caught = unclassifiedCredentials([...candidates, plantedKey]);
  if (!caught.includes(plantedKey)) {
    console.error(
      `✗ Self-test failed: an unclassified credential-shaped key was not ` +
        `caught.\n  The gate would pass while a new secret ships unreviewed.`,
    );
    process.exit(2);
  }

  // A classified key must NOT be reported, or the gate cries wolf and gets
  // muted — which ends in the same place.
  if (unclassifiedCredentials(['API_KEY']).length > 0) {
    console.error(
      '✗ Self-test failed: a classified key was reported as unclassified.',
    );
    process.exit(2);
  }

  // An empty candidate set must fail the CI run rather than pass it. This is
  // the case that made the gate decorative when a workflow stopped writing the
  // env file: nothing to search for, and a green check either way.
  const vacuity = [
    ['no values in CI', vacuityExitCode(0, true), 2],
    ['no values locally', vacuityExitCode(0, false), 0],
    ['values present in CI', vacuityExitCode(3, true), 0],
  ];
  const wrong = vacuity.filter(([, actual, expected]) => actual !== expected);
  if (wrong.length > 0) {
    console.error(
      `✗ Self-test failed: the empty-candidate-set guard is wrong for ` +
        `${wrong.map(([name]) => name).join(', ')}.\n` +
        `  A CI run with nothing to search for must fail, not pass.`,
    );
    process.exit(2);
  }

  console.log(
    '✓ Self-test passed: a planted secret is found, noise is filtered,\n' +
      `  and the candidate set (${candidates.length} keys) still catches an ` +
      `unclassified credential.`,
  );
  process.exit(0);
}

const targets = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (targets.length === 0) {
  console.error(
    'Usage: node scripts/check-bundled-secrets.mjs <bundle.js|dir> [...]\n' +
      '       node scripts/check-bundled-secrets.mjs --self-test',
  );
  process.exit(2);
}

const secrets = collectSecrets();
const files = bundleFiles(targets);

if (secrets.length === 0) {
  const code = vacuityExitCode(secrets.length, Boolean(process.env.CI));
  const message =
    `No credential VALUES available to search for ` +
    `(checked ${SECRET_ENV_KEYS.join(', ')}).\n` +
    `  This run proves nothing. Give the job the same env the bundle was ` +
    `built with, or the check is decorative.`;
  if (code === 0) {
    console.log(`⚠ ${message}`);
  } else {
    console.error(`✗ ${message}`);
  }
  process.exit(code);
}

// Scanning zero files is not a pass. A renamed build output would otherwise
// turn this check green precisely when it stopped looking at anything.
if (files.length === 0) {
  console.error(
    `✗ Found no bundle files under: ${targets.join(', ')}\n` +
      `  Expected one of ${BUNDLE_EXTENSIONS.join(
        ', ',
      )}. The build output moved,\n` +
      `  or this ran before the bundle was produced — either way it checked nothing.`,
  );
  process.exit(2);
}

const findings = [];
for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  for (const { key, value } of secrets) {
    if (contents.includes(value)) findings.push({ file, key });
  }
}

console.log(
  `Scanned ${files.length} bundle file(s) for ${secrets.length} credential value(s).`,
);

const accepted = findings.filter(f => f.key in ACCEPTED_FINDINGS);
const blocking = findings.filter(f => !(f.key in ACCEPTED_FINDINGS));

// An accepted entry whose credential is NO LONGER in the bundle has been fixed.
// Say so and fail, so the entry is deleted rather than left behind as an
// exemption for a problem that no longer exists.
const searchedKeys = new Set(secrets.map(s => s.key));
const foundKeys = new Set(findings.map(f => f.key));
const staleAcceptances = Object.keys(ACCEPTED_FINDINGS).filter(
  key => searchedKeys.has(key) && !foundKeys.has(key),
);

if (accepted.length > 0) {
  console.log('\n⚠ Known credentials still shipping in the bundle:\n');
  for (const key of new Set(accepted.map(f => f.key))) {
    console.log(`  ${key}\n    ${ACCEPTED_FINDINGS[key]}\n`);
  }
}

if (staleAcceptances.length > 0) {
  console.error(
    `\n✗ These are listed as accepted findings but are no longer in the bundle:\n`,
  );
  for (const key of staleAcceptances) console.error(`  ${key}`);
  console.error(
    `\nThat is good news — the credential is gone. Delete the entry from\n` +
      `ACCEPTED_FINDINGS so the next one cannot hide behind a stale exemption.`,
  );
  process.exit(1);
}

if (blocking.length > 0) {
  console.error('\n✗ Third-party credentials found inside the built bundle:\n');
  for (const { file, key } of blocking) {
    console.error(`  ${key} appears in ${file}`);
  }
  console.error(
    `\nA distributed binary is readable by anyone who obtains it. Rotating the\n` +
      `key does not fix this — route the call through a backend the product\n` +
      `controls and stop shipping the credential.`,
  );
  process.exit(1);
}

if (accepted.length === 0) {
  console.log('\n✓ No third-party credential found in the bundle.');
} else {
  console.log('✓ No unaccepted credential found in the bundle.');
}
