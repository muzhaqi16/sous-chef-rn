#!/usr/bin/env node
/**
 * Asserts the build identity in `src/config/env.generated.ts` is the one this
 * build intended.
 *
 * A measurement that cannot be traced to a commit is not evidence, and the
 * identity is written by a script that runs several times per build:
 * `metro.config.js` calls `generateEnv()` at module scope, so every Metro start
 * and every bundling step rewrites the file. CI set GIT_SHA and BUILD_ID on one
 * step's `env:` block, and the gradle step's Metro process — which inherited
 * neither — then replaced them with `gitSha()`'s short `-dirty` sha and
 * `undefined`. The shipped `env.generated.ts` recorded exactly that.
 *
 * Checking configuration time is not enough, because the overwrite happens
 * after it. Run this as late as possible, and ideally again after bundling.
 *
 *   GIT_SHA=<sha> BUILD_ID=<n> node scripts/check-build-provenance.mjs
 *
 * With neither variable set it verifies only that SOME identity is recorded,
 * which is the useful local check.
 */
import { readFileSync, existsSync } from 'node:fs';
import { readGeneratedValue } from './generate-env.js';

const GENERATED = new URL('../src/config/env.generated.ts', import.meta.url);

if (!existsSync(GENERATED)) {
  console.error(
    `✗ src/config/env.generated.ts does not exist.\n` +
      `  Run \`node scripts/generate-env.js\` before this check.`,
  );
  process.exit(2);
}

const source = readFileSync(GENERATED, 'utf8');

/** Read a generated key's value; `null` when it was written as `undefined`. */
const generatedValue = key => readGeneratedValue(source, key);

const failures = [];

// A local `npm start` has no BUILD_ID and never will — only a build run
// assigns one. Absence is a failure only where an identity was actually
// promised: in CI, or when this invocation named an expected value.
const identityRequired = Boolean(process.env.CI);

for (const key of ['GIT_SHA', 'BUILD_ID']) {
  const actual = generatedValue(key);
  const expected = process.env[key];

  if (actual === undefined) {
    failures.push(`${key} is not present in the generated config at all.`);
    continue;
  }
  if (actual === null || actual === '') {
    if (identityRequired || expected) {
      failures.push(
        `${key} is empty. A build with no identity cannot be traced to the ` +
          `code that produced it.`,
      );
    }
    continue;
  }
  if (expected && actual !== expected) {
    failures.push(
      `${key} is "${actual}" but this build intended "${expected}". ` +
        `Something regenerated the config after CI set it.`,
    );
  }
}

// `-dirty` is honest locally; in CI it means the checkout was modified, so the
// recorded sha no longer identifies a single tree.
const sha = generatedValue('GIT_SHA');
if (process.env.CI && typeof sha === 'string' && sha.endsWith('-dirty')) {
  failures.push(
    `GIT_SHA is "${sha}". A CI build should be reproducible from its commit; ` +
      `the working tree had uncommitted or untracked changes.`,
  );
}

if (failures.length > 0) {
  console.error(
    `\n✗ Build provenance check failed:\n\n` +
      failures.map(f => `  ${f}`).join('\n') +
      `\n\n  Build identity is written into the env FILE (not a step \`env:\`\n` +
      `  block) precisely so it survives Metro regenerating the config during\n` +
      `  bundling. See scripts/generate-env.js.`,
  );
  process.exit(1);
}

const show = key => generatedValue(key) ?? '(unset)';
console.log(
  `✓ Build provenance: GIT_SHA=${show('GIT_SHA')} BUILD_ID=${show('BUILD_ID')}`,
);
