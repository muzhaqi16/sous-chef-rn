#!/usr/bin/env node
/**
 * Refuses to let a distributable build accept an injected session.
 *
 * `ALLOW_LAUNCH_ARG_AUTH` lets a build take `detoxUserToken` /
 * `detoxRefreshToken` from launch arguments and sign itself in. That is exactly
 * what the performance suite needs from a LOCAL release build, and exactly what
 * must never reach anyone else.
 *
 * The check is on the generated config rather than on the shell environment,
 * because the generated config is what the bundle actually reads — and it is
 * rewritten by Metro several times per build.
 *
 *   node scripts/check-launch-arg-auth.mjs
 *
 * Fails when the capability is enabled alongside a production or staging
 * NODE_ENV, and (in CI) whenever it is enabled at all.
 */
import { readFileSync, existsSync } from 'node:fs';

const GENERATED = new URL('../src/config/env.generated.ts', import.meta.url);

if (!existsSync(GENERATED)) {
  console.error(
    `✗ src/config/env.generated.ts does not exist.\n` +
      `  Run \`node scripts/generate-env.js\` before this check.`,
  );
  process.exit(2);
}

const source = readFileSync(GENERATED, 'utf8');

const value = key => {
  const match = source.match(new RegExp(`^  ${key}: "([^"]*)",$`, 'm'));
  return match ? match[1] : undefined;
};

const enabled = value('ALLOW_LAUNCH_ARG_AUTH') === 'true';
const nodeEnv = value('NODE_ENV');

if (!enabled) {
  console.log('✓ Launch-argument authentication is off in this build.');
  process.exit(0);
}

const reasons = [];
if (nodeEnv === 'production' || nodeEnv === 'staging') {
  reasons.push(
    `NODE_ENV is "${nodeEnv}", so this build is intended for someone other ` +
      `than the developer who produced it.`,
  );
}
if (process.env.CI) {
  reasons.push(
    'This is a CI build. Builds that leave this machine must never accept an ' +
      'externally supplied session, whatever their environment designation.',
  );
}

if (reasons.length > 0) {
  console.error(
    `\n✗ ALLOW_LAUNCH_ARG_AUTH is enabled on a build that must not have it:\n\n` +
      reasons.map(r => `  ${r}`).join('\n') +
      `\n\n  This capability belongs to local measuring builds only —\n` +
      `  \`MODE=release npm run ios\` and Android \`localRelease\`, which export\n` +
      `  it from scripts/run-*.sh. It must not be written into a committed env\n` +
      `  file, and CI must not set it.`,
  );
  process.exit(1);
}

console.log(
  `✓ Launch-argument authentication is enabled, and this is a local ` +
    `${nodeEnv ?? 'unset-NODE_ENV'} build — the one place that is allowed.`,
);
