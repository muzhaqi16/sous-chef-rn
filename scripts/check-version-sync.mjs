#!/usr/bin/env node
// The release version has to read the same on every platform, because two
// mechanisms key off the value the RUNNING BUILD reports rather than the value
// in package.json:
//
//   - `CURRENT_CACHE_VERSION = getVersion()` in
//     `src/apollo/offline/ApolloCachePersistence.ts` purges the persisted MMKV
//     cache when the version changes. A platform whose native version does not
//     advance keeps a cache written by the previous release — including
//     entities missing fields the new queries select.
//   - `CLIENT_VERSION` in `src/apollo/clientIdentity.ts` is what the server
//     matches against its minimum-version gate.
//
// `getVersion()` is native (`CFBundleShortVersionString` on iOS,
// `versionName` on Android), so nothing in the JS build fails when one of them
// drifts. That is what this script is for.
//
// NOT checked: iOS `CURRENT_PROJECT_VERSION` and Android `versionCode`. Those
// are per-platform build counters on independent sequences, read by
// `getBuildNumber()` rather than `getVersion()`, and neither mechanism above
// looks at them.
//
// Usage: node scripts/check-version-sync.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = relative => readFileSync(join(ROOT, relative), 'utf-8');

/** Every place the release version is declared, as `{ source, version }`. */
const collectDeclarations = () => {
  const found = [];

  const pkg = JSON.parse(read('package.json'));
  found.push({ source: 'package.json "version"', version: pkg.version });

  const gradle = read('android/app/build.gradle');
  const versionName = gradle.match(/^\s*versionName\s+"([^"]+)"/m);
  found.push({
    source: 'android/app/build.gradle versionName',
    version: versionName?.[1],
  });

  // One entry per build configuration (Debug and Release), so a bump that
  // touches only one of them is caught.
  const pbxproj = read('ios/SousChefRN.xcodeproj/project.pbxproj');
  const marketingVersions = [
    ...pbxproj.matchAll(/^\s*MARKETING_VERSION\s*=\s*([^;\s]+);/gm),
  ];
  if (marketingVersions.length === 0) {
    found.push({
      source: 'ios project.pbxproj MARKETING_VERSION',
      version: undefined,
    });
  }
  marketingVersions.forEach((match, index) => {
    found.push({
      source: `ios project.pbxproj MARKETING_VERSION [#${index + 1}]`,
      version: match[1],
    });
  });

  return found;
};

const declarations = collectDeclarations();

const missing = declarations.filter(d => !d.version);
const versions = new Set(declarations.map(d => d.version));

if (missing.length > 0 || versions.size > 1) {
  console.error('✗ Client version is not in sync across platforms.\n');
  for (const { source, version } of declarations) {
    console.error(`    ${version ?? '(not found)'}\t${source}`);
  }
  console.error(
    missing.length > 0
      ? '\nA version could not be read — the file moved, or its format changed.'
      : '\nA build reports its NATIVE version, so the mismatched platform ships' +
          '\nwith a stale cache and the wrong version on the server upgrade gate.',
  );
  process.exit(1);
}

console.log(
  `✓ Client version ${declarations[0].version} is consistent across ${declarations.length} declarations.`,
);
