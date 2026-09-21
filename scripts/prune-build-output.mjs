#!/usr/bin/env node
/**
 * Delete native build output that no build has used for `--max-age-days` or an
 * older Xcode wrote, then refuse a build the disk cannot hold. Nothing else ever
 * deletes it. `--max-age-days 0` removes all of it.
 *
 *   node scripts/prune-build-output.mjs [--max-age-days 14] [--min-free-gb 15] [--dry-run]
 */
import {
  existsSync,
  globSync,
  readdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import {
  bytes,
  fromRoot,
  parseFlags,
  REPO_ROOT,
  sh,
  sizeOf,
} from './lib/tooling.mjs';

const flags = parseFlags({
  'max-age-days': { type: 'string', default: '14' },
  'min-free-gb': { type: 'string', default: '15' },
  'dry-run': { type: 'boolean', default: false },
});

const MAX_AGE_DAYS = Number(flags['max-age-days']);
const MIN_FREE_GB = Number(flags['min-free-gb']);
const DRY_RUN = flags['dry-run'];

if (!(MAX_AGE_DAYS >= 0) || !(MIN_FREE_GB >= 0)) {
  console.error(
    '✗ --max-age-days and --min-free-gb must be non-negative numbers.',
  );
  process.exit(2);
}

// CI runners start empty, and their free space is below any useful floor.
if (process.env.CI) process.exit(0);

const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
const day = ms => new Date(ms).toISOString().slice(0, 10);
const mtime = path => (existsSync(path) ? statSync(path).mtimeMs : 0);
const tryRun = (cmd, args) => {
  try {
    return sh(cmd, args).trim();
  } catch {
    return undefined;
  }
};

let reclaimed = 0;

function remove(label, paths, reason) {
  const size = paths.reduce((sum, path) => sum + sizeOf(path), 0);
  reclaimed += size;
  console.log(
    `${DRY_RUN ? 'Would remove' : 'Removed'} ${label} (${reason}): ${bytes(
      size,
    )}`,
  );
  if (DRY_RUN) return;
  for (const path of paths) rmSync(path, { recursive: true, force: true });
}

// Staleness comes from what each build system stamps per build, never from
// output mtimes: an incremental build leaves up-to-date outputs untouched.

const XCODE_STAMP = '.xcode-build-version';
// RN codegen output the Pods project links into; only `pod install` rewrites it.
const CODEGEN_OUTPUT = 'generated';
const xcodeBuild = tryRun('xcodebuild', ['-version'])?.replace('\n', ' ');

if (xcodeBuild) {
  const xcodeDerivedData = join(
    homedir(),
    'Library/Developer/Xcode/DerivedData',
  );
  const derivedDataDirs = [
    fromRoot('ios/build'),
    ...(existsSync(xcodeDerivedData)
      ? globSync('SousChefRN-*', { cwd: xcodeDerivedData }).map(name =>
          join(xcodeDerivedData, name),
        )
      : []),
  ].filter(dir => existsSync(dir));

  for (const dir of derivedDataDirs) {
    const stampFile = join(dir, XCODE_STAMP);
    const stamp = existsSync(stampFile)
      ? readFileSync(stampFile, 'utf8').trim()
      : undefined;
    const accessed = Date.parse(
      tryRun('plutil', [
        '-extract',
        'LastAccessedDate',
        'raw',
        '-o',
        '-',
        join(dir, 'info.plist'),
      ]) ?? '',
    );
    const lastUsed = Number.isNaN(accessed)
      ? mtime(join(dir, 'Logs/Build'))
      : accessed;

    let reason;
    if (stamp !== undefined && stamp !== xcodeBuild) {
      reason = `written by ${stamp}, Xcode is now ${xcodeBuild}`;
    } else if (lastUsed < cutoff) {
      reason = lastUsed ? `unused since ${day(lastUsed)}` : 'never used';
    }

    const children = readdirSync(dir).filter(name => name !== XCODE_STAMP);
    const doomed = children.includes(CODEGEN_OUTPUT)
      ? children
          .filter(name => name !== CODEGEN_OUTPUT)
          .map(name => join(dir, name))
      : [dir];
    const label = dir.startsWith(REPO_ROOT)
      ? relative(REPO_ROOT, dir)
      : dir.replace(homedir(), '~');

    if (reason && children.length && doomed.length)
      remove(label, doomed, reason);
    if (!DRY_RUN && existsSync(dir))
      writeFileSync(stampFile, `${xcodeBuild}\n`);
  }
}

// Gradle rewrites both on every build; a library's own `build/` is only touched
// when that library recompiles.
const gradleLastBuild = Math.max(
  mtime(fromRoot('android/.gradle/file-system.probe')),
  mtime(fromRoot('android/.gradle/buildOutputCleanup/buildOutputCleanup.lock')),
);
const androidOutputs = [
  ...['android/build', 'android/app/build', 'android/app/.cxx']
    .map(path => fromRoot(path))
    .filter(path => existsSync(path)),
  ...globSync(
    [
      'node_modules/*/android/build',
      'node_modules/*/android/.cxx',
      'node_modules/@*/*/android/build',
      'node_modules/@*/*/android/.cxx',
    ],
    { cwd: REPO_ROOT },
  ).map(path => fromRoot(path)),
];

if (androidOutputs.length && gradleLastBuild < cutoff) {
  remove(
    'Android native build output',
    androidOutputs,
    gradleLastBuild
      ? `last Gradle build ${day(gradleLastBuild)}`
      : 'no Gradle build recorded',
  );
}

if (reclaimed) {
  console.log(
    `${DRY_RUN ? 'Would reclaim' : 'Reclaimed'} ${bytes(
      reclaimed,
    )} of native build output.`,
  );
}

const { bavail, bsize } = statfsSync(REPO_ROOT);
const free = bavail * bsize;
if (free < MIN_FREE_GB * 1024 ** 3) {
  console.error(
    `\n✗ ${bytes(
      free,
    )} free; a clean native build needs about ${MIN_FREE_GB} GB.\n` +
      '  `npm run build:prune -- --max-age-days 0` removes all native build\n' +
      '  output in this checkout; anything else is outside the repo.\n',
  );
  process.exit(1);
}
