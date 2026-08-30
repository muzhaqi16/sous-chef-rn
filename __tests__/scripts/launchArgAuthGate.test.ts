import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * The launch-argument-auth gate can actually refuse.
 *
 * Two ways it could not. On Android both modes short-circuited on
 * `ALLOW_LAUNCH_ARG_AUTH` BEFORE anything looked at the signing config, and
 * printed "✓ … is off" while doing it — but `allowsLaunchArgAuth()` is
 * `__DEV__ || flag`, so on a development bundle the capability is live with the
 * flag unset and the only check that inspects the artifact was skipped. On iOS
 * `run-ios.sh` passed a hardcoded `--sdk iphonesimulator`, which is the single
 * value the iOS branch tests for — making its one refusal condition
 * unfalsifiable.
 *
 * CLAUDE.md: "Launch-argument auth is gated on the ARTIFACT, not the
 * environment."
 */

const ROOT = path.join(__dirname, '..', '..');
const GATE = path.join(ROOT, 'scripts', 'check-launch-arg-auth.mjs');

/** Run the gate, returning its exit code and combined output. */
function runGate(
  args: string[],
  env: Record<string, string> = {},
): { code: number; output: string } {
  try {
    const output = execFileSync('node', [GATE, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CI: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

describe('the launch-argument-auth gate', () => {
  describe('android', () => {
    it('allows a debug-signed development build', () => {
      const { code } = runGate(['--platform', 'android', '--variant', 'debug']);
      expect(code).toBe(0);
    });

    it('refuses a distribution-signed build that has the capability', () => {
      const { code, output } = runGate(
        ['--platform', 'android', '--variant', 'release'],
        { ALLOW_LAUNCH_ARG_AUTH: 'true' },
      );

      expect(code).toBe(1);
      expect(output).toContain('signingConfigs.release');
    });

    it('does not report a distribution build as safe without inspecting it', () => {
      // The old order printed "✓ … is off" for this without ever reading the
      // signing config. It may still pass — a release BUNDLE has no `__DEV__`
      // — but the message has to be about the artifact.
      const { output } = runGate(['--platform', 'android', '--variant', 'release']);

      expect(output).toContain('signingConfigs.release');
    });

    it('names the reason the capability is live on a dev bundle', () => {
      const { output } = runGate(['--platform', 'android', '--variant', 'debug']);

      expect(output).toContain('__DEV__ bundle');
    });
  });

  describe('ios', () => {
    it('refuses a device destination that has the capability', () => {
      const { code, output } = runGate(
        ['--platform', 'ios', '--sdk', 'iphoneos'],
        { ALLOW_LAUNCH_ARG_AUTH: 'true' },
      );

      expect(code).toBe(1);
      expect(output).toContain('iphoneos');
    });

    it('allows the simulator', () => {
      const { code } = runGate(['--platform', 'ios', '--sdk', 'iphonesimulator'], {
        ALLOW_LAUNCH_ARG_AUTH: 'true',
      });

      expect(code).toBe(0);
    });

    it('requires the destination to be passed at all', () => {
      const { code, output } = runGate(['--platform', 'ios']);

      expect(code).toBe(2);
      expect(output).toContain('--sdk');
    });
  });

  it('run-ios.sh derives the sdk instead of hardcoding it', () => {
    // A literal on the gate's command line, beside a build that read its
    // destination from elsewhere, is what made the check unfalsifiable.
    const script = fs.readFileSync(path.join(ROOT, 'scripts', 'run-ios.sh'), 'utf8');

    expect(script).not.toMatch(/--sdk\s+iphonesimulator\b/);
    expect(script).toMatch(/--sdk\s+"\$IOS_SDK"/);
  });
});
