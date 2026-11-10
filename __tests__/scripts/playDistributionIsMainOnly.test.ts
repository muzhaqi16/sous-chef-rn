import { readFileSync } from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';

/**
 * Only main reaches Play, and Play access stays off the build runners. Each
 * job's condition runs here as an expression, as `releaseIsHeldToProduction`
 * runs the release check's.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  readFileSync(path.join(ROOT, ...parts), 'utf8');

const build = read('.github', 'workflows', 'build-android.yml');
const promote = read('.github', 'workflows', 'promote-android.yml');
const fastfile = read('fastlane', 'Fastfile');

const jobOf = (workflow: string, name: string): string => {
  const [, rest = ''] = workflow.split(new RegExp(`^ {2}${name}:$`, 'm'));
  const [job = ''] = rest.split(/^ {2}[a-zA-Z_-]+:$/m);
  return job;
};

const lineIf = (job: string): string => {
  const [, condition = ''] = /^ {4}if: (.+)$/m.exec(job) ?? [];
  return condition;
};

interface Run {
  event: 'push' | 'workflow_dispatch';
  ref: string;
  buildType?: string;
  environment?: string;
}

/** GitHub's expression over these operands reads the same as JavaScript. */
const evaluate = (
  expression: string,
  { event, ref, buildType, environment }: Run,
): unknown =>
  runInNewContext(expression, {
    github: { event_name: event, ref, run_id: '42' },
    inputs: { build_type: buildType, environment },
  });

const MAIN = 'refs/heads/main';

describe('a version code is asked of Play', () => {
  const condition = lineIf(jobOf(build, 'version-code'));

  it.each<[string, Run, boolean]>([
    ['a merge to main', { event: 'push', ref: MAIN }, true],
    [
      'a prod Play dispatch on main',
      {
        event: 'workflow_dispatch',
        ref: MAIN,
        buildType: 'playstore',
        environment: 'prod',
      },
      true,
    ],
    [
      'a dev Play dispatch on main',
      {
        event: 'workflow_dispatch',
        ref: MAIN,
        buildType: 'playstore',
        environment: 'dev',
      },
      false,
    ],
    [
      'an APK dispatch on main',
      {
        event: 'workflow_dispatch',
        ref: MAIN,
        buildType: 'apk',
        environment: 'prod',
      },
      false,
    ],
    [
      'a Play dispatch on a feature branch',
      {
        event: 'workflow_dispatch',
        ref: 'refs/heads/feature',
        buildType: 'playstore',
        environment: 'prod',
      },
      false,
    ],
    [
      'a store tag',
      { event: 'push', ref: 'refs/tags/playstore-v4.10.0' },
      false,
    ],
  ])('for %s: %s', (_, run, asks) => {
    expect(evaluate(condition, run)).toBe(asks);
  });

  it('and those runs, alone, go one at a time', () => {
    const [, group = ''] =
      /^ {2}group: \$\{\{ (.+) \}\}$/m.exec(build.split(/^jobs:$/m)[0] ?? '') ??
      [];

    expect(evaluate(group, { event: 'push', ref: MAIN })).toBe('play-main');
    expect(
      evaluate(group, { event: 'push', ref: 'refs/tags/dev-v1.0.0' }),
    ).toBe('42');
    expect(build).toMatch(/^ {2}cancel-in-progress: false$/m);
  });
});

describe('an upload', () => {
  const job = jobOf(build, 'upload-internal');

  it('waits on a version code from Play, so only main uploads', () => {
    expect(job).toContain("needs.version-code.result == 'success'");
  });
});

describe('a promotion', () => {
  it.each([
    [MAIN, true],
    ['refs/heads/feature', false],
    ['refs/tags/playstore-v4.10.0', false],
  ])('dispatched on %s runs: %s', (ref, runs) => {
    expect(
      evaluate(lineIf(jobOf(promote, 'promote')), {
        event: 'workflow_dispatch',
        ref,
      }),
    ).toBe(runs);
  });

  it('waits for the release owner', () => {
    expect(jobOf(promote, 'promote')).toMatch(
      /^ {4}environment: play-production$/m,
    );
  });
});

describe('Play access', () => {
  it.each(['build-self-hosted', 'build-github-hosted'])(
    'never reaches %s',
    name => {
      const job = jobOf(build, name);

      expect(job).not.toContain('setup-fastlane');
      expect(job).not.toContain('id-token');
    },
  );

  it('is granted to no workflow as a whole', () => {
    for (const workflow of [build, promote]) {
      expect(workflow.split(/^jobs:$/m)[0]).not.toContain('id-token');
    }
  });

  it('is asked for only by the jobs that talk to Play', () => {
    const asking = [...`${build}\n${promote}`.matchAll(/^ {2}([a-z-]+):$/gm)]
      .map(([, name = '']) => name)
      .filter(name =>
        jobOf(build, name).concat(jobOf(promote, name)).includes('id-token'),
      );

    expect(asking.sort()).toEqual([
      'promote',
      'upload-internal',
      'version-code',
    ]);
  });
});

describe('every call that writes to Play', () => {
  const calls = fastfile.split('upload_to_play_store(').slice(1);

  it('is found', () => {
    expect(calls).toHaveLength(2);
  });

  it.each(calls.map(call => [call.slice(0, call.indexOf('\n    )'))]))(
    'never writes listing text and never hides a refusal',
    call => {
      expect(call).toContain('skip_upload_metadata: true');
      expect(call).toContain('skip_upload_images: true');
      expect(call).toContain('skip_upload_screenshots: true');
      expect(call).toContain('rescue_changes_not_sent_for_review: false');
    },
  );
});
