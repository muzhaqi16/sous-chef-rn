/**
 * The lint toolchain moves when React Native's preset does, not before.
 *
 * `@react-native/eslint-config` supplies the base config, the parser wiring and
 * eight plugins, and it declares which ESLint majors it supports. Installing a
 * newer ESLint than that range leaves the preset unsupported — npm refuses the
 * install outright, and forcing past it means the preset's rules run against a
 * core it was never tested on.
 *
 * The flat config is a separate axis and already adopted — `eslint.config.js`
 * consumes `@react-native/eslint-config/flat`. What pins the major is the peer
 * range, and ESLint 10 is outside it in every published preset: the stable
 * release, the next release candidate, and the nightlies all peer `^8 || ^9`.
 * `eslint-plugin-import` is the other half of the same wait — it is swapped for
 * `eslint-plugin-import-x`, which does accept `^10`, when the preset moves and
 * not before, since the swap buys nothing while the preset pins the major.
 *
 * This asserts the alignment rather than describing it, so a premature bump
 * fails here with the reason instead of failing an `npm ci` in CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as semver from 'semver';

const ROOT = join(__dirname, '..', '..');

const installed = (name: string): { version: string; peer?: string } => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8'),
  ) as {
    version: string;
    peerDependencies?: Record<string, string>;
  };
  return { version: manifest.version, peer: manifest.peerDependencies?.eslint };
};

describe('the lint toolchain follows React Native', () => {
  const eslint = installed('eslint');
  const preset = installed('@react-native/eslint-config');

  it('reads both versions, so the check below is not vacuous', () => {
    expect(semver.valid(eslint.version)).not.toBeNull();
    expect(preset.peer).toBeTruthy();
  });

  it('runs an ESLint the React Native preset supports', () => {
    expect({
      eslint: eslint.version,
      supportedByPreset: preset.peer,
      satisfies: semver.satisfies(eslint.version, preset.peer!),
    }).toEqual({
      eslint: eslint.version,
      supportedByPreset: preset.peer,
      satisfies: true,
    });
  });

  it('keeps the preset on the same release train as react-native', () => {
    // A preset from a different RN minor carries a different plugin set than
    // the runtime it is meant to describe.
    const rn = installed('react-native').version;
    expect(semver.major(preset.version)).toBe(semver.major(rn));
    expect(semver.minor(preset.version)).toBe(semver.minor(rn));
  });
});
