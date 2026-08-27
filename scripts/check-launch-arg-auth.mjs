#!/usr/bin/env node
/**
 * Refuses to let a distributable build accept an injected session.
 *
 * `ALLOW_LAUNCH_ARG_AUTH` lets a build take `detoxUserToken` /
 * `detoxRefreshToken` from launch arguments and sign itself in. That is exactly
 * what the performance suite needs from a LOCAL release build, and exactly what
 * must never reach anyone else.
 *
 * Two modes, because the source of truth differs by when the check runs:
 *
 *   node scripts/check-launch-arg-auth.mjs
 *     POST-HOC (pre-push, CI). Reads `src/config/env.generated.ts` — what the
 *     bundle actually got. No artifact is identified, so it can only judge the
 *     environment, and it says so rather than reporting a clean bill.
 *
 *   node scripts/check-launch-arg-auth.mjs --platform android --variant <name>
 *   node scripts/check-launch-arg-auth.mjs --platform ios --sdk <sdk>
 *     ON THE BUILD PATH (run-android.sh, run-ios.sh). Reads the flag from the
 *     environment about to be handed to the build — the generated config has
 *     not been written yet — and judges it against the artifact's DISTRIBUTION
 *     IDENTITY, not its environment designation.
 *
 * Environment alone was never the right test. `MODE=release npm run android`
 * resolves to a development NODE_ENV *and* signs with the distribution key; the
 * environment half looks fine and the artifact is one you could hand to someone.
 * So the Android variant's signing config is read out of build.gradle, and any
 * variant not signed with the debug key is refused.
 */
import { readFileSync, existsSync } from 'node:fs';
import { readGeneratedValue } from './generate-env.js';
import { parseFlags } from './lib/tooling.mjs';

const GENERATED = new URL('../src/config/env.generated.ts', import.meta.url);
const BUILD_GRADLE = new URL('../android/app/build.gradle', import.meta.url);

// `strict` matters here: a `--platform` with no value used to read as absent
// and drop the gate into post-hoc mode, judging the environment instead of the
// artifact. For a gate whose failure mode is checking the wrong thing, an
// explicit throw beats a silent fallback.
const flags = parseFlags({
  platform: { type: 'string' },
  variant: { type: 'string' },
  sdk: { type: 'string' },
});

const platform = flags.platform;

/**
 * Maps every Android build type to the signing config it declares.
 *
 * Read from build.gradle rather than hardcoded so a variant added there cannot
 * pick up the capability by being absent from a list here. `initWith release`
 * inherits the signing config, which is why `localRelease` has to override it
 * explicitly — and why an inherited one is reported as unknown rather than
 * assumed safe.
 */
function androidSigningConfigs() {
  const gradle = readFileSync(BUILD_GRADLE, 'utf8');
  const buildTypes = gradle.match(/buildTypes\s*\{([\s\S]*?)\n {4}\}/);
  if (!buildTypes) return null;

  const configs = new Map();
  const blocks = buildTypes[1].matchAll(/\n {8}(\w+)\s*\{([\s\S]*?)\n {8}\}/g);
  for (const [, name, body] of blocks) {
    const signing = body.match(/signingConfig\s+signingConfigs\.(\w+)/);
    configs.set(name, signing ? signing[1] : undefined);
  }
  return configs;
}

function refuse(reasons, artifact) {
  console.error(
    `\n✗ ALLOW_LAUNCH_ARG_AUTH is enabled on a build that must not have it` +
      `${artifact ? ` (${artifact})` : ''}:\n\n` +
      reasons.map(r => `  ${r}`).join('\n') +
      `\n\n  This capability belongs to builds that cannot be distributed —\n` +
      `  \`MODE=release npm run ios\` (simulator) and Android \`localRelease\`\n` +
      `  (debug-signed), which export it from scripts/run-*.sh. It must not be\n` +
      `  written into a committed env file, and CI must not set it.`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build-path mode: judge the artifact about to be produced.
// ---------------------------------------------------------------------------
if (platform) {
  const enabled = process.env.ALLOW_LAUNCH_ARG_AUTH === 'true';

  if (platform === 'android') {
    const variant = flags.variant;
    if (!variant) {
      console.error('✗ --platform android requires --variant <name>.');
      process.exit(2);
    }

    const configs = androidSigningConfigs();
    if (!configs || configs.size === 0) {
      // An empty parse is a failure of this check, not a pass: it means the
      // gradle shape changed and every variant would read as unknown.
      console.error(
        `✗ Could not read any buildType from android/app/build.gradle.\n` +
          `  This check cannot judge the artifact, so it fails rather than\n` +
          `  letting an unexamined build through.`,
      );
      process.exit(2);
    }

    const signing = configs.get(variant);
    const distributable = signing !== 'debug';

    if (!enabled) {
      console.log(
        `✓ Launch-argument authentication is off for android:${variant} ` +
          `(signingConfigs.${signing ?? 'inherited'}).`,
      );
      process.exit(0);
    }

    if (distributable) {
      refuse(
        [
          signing
            ? `Variant "${variant}" signs with signingConfigs.${signing}, not the ` +
              `debug key, so the APK it produces can be installed by anyone it ` +
              `is handed to.`
            : `Variant "${variant}" declares no signingConfig of its own, so its ` +
              `signing identity is inherited and cannot be confirmed as ` +
              `non-distributable here.`,
        ],
        `android:${variant}`,
      );
    }

    console.log(
      `✓ Launch-argument authentication is enabled for android:${variant}, ` +
        `which is debug-signed — the one place that is allowed.`,
    );
    process.exit(0);
  }

  if (platform === 'ios') {
    const sdk = flags.sdk;
    if (!enabled) {
      console.log(
        `✓ Launch-argument authentication is off for ios (sdk ${
          sdk ?? 'unset'
        }).`,
      );
      process.exit(0);
    }
    // A simulator build cannot be installed on a phone, so the Release
    // configuration is safe there — which is what makes iOS measuring runs
    // possible without a separate variant. Any other SDK produces something
    // that could be signed for a device.
    if (sdk !== 'iphonesimulator') {
      refuse(
        [
          `The build targets sdk "${sdk ?? 'unset'}" rather than ` +
            `iphonesimulator, so it produces an artifact that can be installed ` +
            `on a device.`,
        ],
        'ios',
      );
    }
    console.log(
      `✓ Launch-argument authentication is enabled for an iphonesimulator ` +
        `build — the one place that is allowed.`,
    );
    process.exit(0);
  }

  console.error(
    `✗ Unknown --platform "${platform}" (expected android or ios).`,
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Post-hoc mode: judge what the bundle actually got.
// ---------------------------------------------------------------------------
if (!existsSync(GENERATED)) {
  console.error(
    `✗ src/config/env.generated.ts does not exist.\n` +
      `  Run \`node scripts/generate-env.js\` before this check.`,
  );
  process.exit(2);
}

const source = readFileSync(GENERATED, 'utf8');

const value = key => readGeneratedValue(source, key);

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

if (reasons.length > 0) refuse(reasons);

// No artifact was named, so the signing identity — the half that actually
// decides this — was not examined. Say that, rather than reporting a pass the
// reader would take as "the build is fine".
console.log(
  `✓ No disqualifying environment found (NODE_ENV ` +
    `${nodeEnv ?? 'unset'}, CI ${process.env.CI ? 'set' : 'unset'}).\n` +
    `  NOT CHECKED: which artifact this is. The signing identity decides ` +
    `whether\n  the capability is allowed, and only the build path can supply ` +
    `it —\n  scripts/run-android.sh and run-ios.sh pass --platform for that.`,
);
