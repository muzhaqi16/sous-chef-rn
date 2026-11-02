import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The script deletes on its own, so it runs here for real, against a fake repo
 * and a fake home: a copy of the script finds its repo root from where it sits.
 * `pgrep`, `xcodebuild` and `plutil` are stubs on PATH, so this needs no Mac.
 */

const ROOT = path.join(__dirname, '..', '..');
const OLD = '2020-01-01T00:00:00Z';
const RECENT = new Date(Date.now() - 86_400_000).toISOString();
const NEWEST = new Date().toISOString();

let sandbox: string;
let repo: string;
let derivedData: string;
let simulators: string;

const write = (file: string, content = 'x') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const stub = (name: string, body: string) =>
  fs.writeFileSync(path.join(sandbox, 'bin', name), `#!/bin/sh\n${body}\n`, {
    mode: 0o755,
  });

const addDerivedData = (name: string, lastUsed: string) => {
  const dir = path.join(derivedData, `SousChefRN-${name}`);
  write(path.join(dir, 'info.plist'), `LastAccessedDate=${lastUsed}\n`);
  write(path.join(dir, 'Build', 'output'));
  return dir;
};

const addSimulatorApp = (udid: string, name: string, version: string) => {
  write(path.join(simulators, udid, 'device.plist'), `name=${name}\n`);
  write(
    path.join(
      simulators,
      udid,
      'data/Containers/Bundle/Application/A/SousChef.app/Info.plist',
    ),
    `CFBundleShortVersionString=${version}\n`,
  );
};

const prune = (...args: string[]) => {
  const result = spawnSync(
    'node',
    [path.join(repo, 'scripts/prune-build-output.mjs'), ...args],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '',
        HOME: sandbox,
        PATH: `${path.join(sandbox, 'bin')}:${process.env.PATH}`,
      },
    },
  );
  return {
    code: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
};

const exists = (...segments: string[]) => fs.existsSync(path.join(...segments));

// Far above any disk, so a run is deterministically below the floor.
const ALWAYS_BELOW = ['--min-free-gb', '999999'];
const NEVER_BELOW = ['--min-free-gb', '0'];

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-'));
  repo = path.join(sandbox, 'repo');
  derivedData = path.join(sandbox, 'Library/Developer/Xcode/DerivedData');
  simulators = path.join(sandbox, 'Library/Developer/CoreSimulator/Devices');
  fs.mkdirSync(path.join(sandbox, 'bin'));
  fs.mkdirSync(path.join(repo, 'scripts/lib'), { recursive: true });
  for (const file of ['prune-build-output.mjs', 'lib/tooling.mjs']) {
    fs.copyFileSync(
      path.join(ROOT, 'scripts', file),
      path.join(repo, 'scripts', file),
    );
  }
  write(path.join(repo, 'package.json'), '{"version":"4.9.0"}');
  write(path.join(repo, 'android/app/build/output'));
  write(path.join(repo, 'node_modules/lib/android/build/output'));
  // A Gradle build a moment ago, so age alone never takes Android output.
  write(path.join(repo, 'android/.gradle/file-system.probe'));
  stub('xcodebuild', 'echo "Xcode 27.0"');
  stub('pgrep', 'exit 1');
  stub('plutil', 'for last; do :; done; sed -n "s/^$2=//p" "$last"');
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('prune-build-output', () => {
  it('keeps recent output while the disk has room', () => {
    const recent = addDerivedData('recent', RECENT);

    const { code } = prune(...NEVER_BELOW);

    expect(code).toBe(0);
    expect(exists(recent, 'Build')).toBe(true);
    expect(exists(repo, 'android/app/build')).toBe(true);
  });

  it('still removes iOS output past its age with the disk at ease', () => {
    const old = addDerivedData('old', OLD);

    prune(...NEVER_BELOW);

    expect(exists(old, 'Build')).toBe(false);
  });

  it('below the floor takes Android output and all iOS output but the newest', () => {
    const older = addDerivedData('older', RECENT);
    const newest = addDerivedData('newest', NEWEST);

    const { code, output } = prune(...ALWAYS_BELOW);

    expect(exists(repo, 'android/app/build')).toBe(false);
    expect(exists(repo, 'node_modules/lib/android/build')).toBe(false);
    expect(exists(older, 'Build')).toBe(false);
    expect(exists(newest, 'Build')).toBe(true);
    // Still short of the floor, so the build is refused.
    expect(code).toBe(1);
    expect(output).toContain('a clean native build needs about');
  });

  it('deletes nothing on a dry run', () => {
    const older = addDerivedData('older', RECENT);
    addDerivedData('newest', NEWEST);

    const { output } = prune(...ALWAYS_BELOW, '--dry-run');

    expect(output).toContain('Would remove Android native build output');
    expect(exists(repo, 'android/app/build')).toBe(true);
    expect(exists(older, 'Build')).toBe(true);
  });

  it('leaves iOS output alone while xcodebuild runs', () => {
    stub(
      'pgrep',
      'case "$2" in *xcodebuild*) echo 1; exit 0;; *) exit 1;; esac',
    );
    const old = addDerivedData('old', OLD);

    prune('--max-age-days', '0', ...NEVER_BELOW);

    expect(exists(old, 'Build')).toBe(true);
    expect(exists(repo, 'android/app/build')).toBe(false);
  });

  it('leaves Android output alone while Gradle runs', () => {
    stub('pgrep', 'case "$2" in *gradle*) echo 1; exit 0;; *) exit 1;; esac');
    const old = addDerivedData('old', OLD);

    prune('--max-age-days', '0', ...NEVER_BELOW);

    expect(exists(repo, 'android/app/build')).toBe(true);
    expect(exists(old, 'Build')).toBe(false);
  });

  it('keeps to the platform it is given', () => {
    const old = addDerivedData('old', OLD);

    prune('--android', '--max-age-days', '0', ...NEVER_BELOW);
    expect(exists(old, 'Build')).toBe(true);
    expect(exists(repo, 'android/app/build')).toBe(false);

    write(path.join(repo, 'android/app/build/output'));
    prune('--ios', '--max-age-days', '0', ...NEVER_BELOW);
    expect(exists(old, 'Build')).toBe(false);
    expect(exists(repo, 'android/app/build')).toBe(true);
  });

  it('warns about a simulator on an older version and never erases it', () => {
    addSimulatorApp('OLD-UDID', 'iPhone Old', '4.8.6');
    addSimulatorApp('TENS-UDID', 'iPhone Tens', '4.10.0');
    addSimulatorApp('SAME-UDID', 'iPhone Same', '4.9.0');

    const { output } = prune(...NEVER_BELOW);

    expect(output).toContain('iPhone Old still has 4.8.6');
    expect(output).toContain('xcrun simctl erase OLD-UDID');
    expect(output).not.toContain('iPhone Tens');
    expect(output).not.toContain('iPhone Same');
    expect(exists(simulators, 'OLD-UDID', 'device.plist')).toBe(true);
  });
});
