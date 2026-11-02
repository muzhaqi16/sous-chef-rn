import { spawnSync } from 'child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { runInNewContext } from 'vm';

/**
 * A store build waits on `release-check`, and a failed check stops it. The
 * job's condition runs here as an expression, and the action's own steps run
 * through bash as a composite step does, with `npm` and `npx` stood in.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts: string[]): string =>
  readFileSync(path.join(ROOT, ...parts), 'utf8');

const android = read('.github', 'workflows', 'build-android.yml');
const ios = read('.github', 'workflows', 'build-ios.yml');
const action = read('.github', 'actions', 'release-check', 'action.yml');

const jobOf = (workflow: string, name: string): string => {
  const [, rest = ''] = workflow.split(new RegExp(`^ {2}${name}:$`, 'm'));
  const [job = ''] = rest.split(/^ {2}[a-zA-Z_-]+:$/m);
  return job;
};

const conditionOf = (job: string): string => {
  const [, block = ''] = job.split(/^ {4}if: \|\n/m);
  const [condition = ''] = block.split(/^ {4}\S/m);
  return condition;
};

interface Run {
  event: string;
  tag?: string;
  environment?: string;
  buildType?: string;
}

/** GitHub's expression over these operands reads the same as JavaScript. */
const checkRunsOn = ({
  event,
  tag = 'main',
  environment,
  buildType,
}: Run): unknown =>
  runInNewContext(conditionOf(jobOf(android, 'release-check')), {
    github: { event_name: event, ref_name: tag },
    inputs: { environment, build_type: buildType },
    startsWith: (text: string, prefix: string) => text.startsWith(prefix),
  });

describe('which Android builds wait on the check', () => {
  it.each([
    ['prod-v4.9.0', true],
    ['playstore-v4.9.0', true],
    ['dev-v4.9.0', false],
    ['stg-v4.9.0', false],
  ])('a push of %s: %s', (tag, runs) => {
    expect(checkRunsOn({ event: 'push', tag })).toBe(runs);
  });

  it.each([
    ['prod', 'apk', true],
    ['dev', 'playstore', true],
    ['dev', 'apk', false],
    ['stg', 'apk', false],
  ])('a dispatch for %s %s: %s', (environment, buildType, runs) => {
    expect(
      checkRunsOn({ event: 'workflow_dispatch', environment, buildType }),
    ).toBe(runs);
  });
});

describe('a build behind the check', () => {
  it.each([
    ['build-self-hosted', android],
    ['build-github-hosted', android],
    ['build_with_signing', ios],
  ])('%s waits on it', (name, workflow) => {
    expect(jobOf(workflow, name)).toContain('needs: release-check');
  });

  it.each(['build-self-hosted', 'build-github-hosted'])(
    '%s runs only on a pass or a skip',
    name => {
      expect(conditionOf(jobOf(android, name))).toContain(
        "(needs.release-check.result == 'success' || needs.release-check.result == 'skipped')",
      );
    },
  );

  it('keeps production schema output out of a build job', () => {
    const jobs = [android, ios].flatMap(workflow => [
      jobOf(workflow, 'build-self-hosted'),
      jobOf(workflow, 'build-github-hosted'),
      jobOf(workflow, 'build_with_signing'),
    ]);

    expect(jobs.join('')).not.toContain('SCHEMA_PATH');
    expect(jobs.join('')).not.toContain('actions/release-check');
    expect(jobOf(android, 'release-check')).not.toContain('setup-deps');
    expect(jobOf(ios, 'release-check')).not.toContain('setup-deps');
    expect(action).not.toContain('API_URL=');
  });
});

describe('the tool', () => {
  const { devDependencies } = JSON.parse(read('package.json')) as {
    devDependencies: Record<string, string>;
  };
  const pinned = devDependencies['@muzhaqi16/api-schema'];

  it('is pinned to one published build', () => {
    expect(pinned).toMatch(/^\d+\.\d+\.\d+-s[0-9a-f]{16}$/);
  });

  it('is never the build whose CLI finds no package', () => {
    expect(pinned).not.toContain('s4b645673c6705366');
  });

  it('never comes from the public registry', () => {
    expect(action).toContain('npx --no api-schema-check');
  });
});

describe('the action’s steps', () => {
  const stepNamed = (name: string): string => {
    const [, rest = ''] = action.split(`- name: ${name}\n`);
    const [step = ''] = rest.split(/^ {4}(?:# .*\n {4})?- name: /m);
    return step
      .slice(step.indexOf('run: |\n') + 'run: |\n'.length)
      .replace(/^ {8}/gm, '');
  };

  let sandbox: string;

  const stub = (name: string, body: string) => {
    const file = path.join(sandbox, 'bin', name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  };

  /** As a composite step runs `shell: bash`. */
  const run = (script: string) =>
    spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          PATH: `${path.join(sandbox, 'bin')}:${process.env.PATH ?? ''}`,
          RUNNER_TEMP: sandbox,
          CALLS: path.join(sandbox, 'calls'),
        },
        encoding: 'utf8',
      },
    );

  const calls = () => read(path.relative(ROOT, path.join(sandbox, 'calls')));

  const report = (...versions: string[]) =>
    writeFileSync(
      path.join(sandbox, 'release-check.json'),
      JSON.stringify({ served: versions.map(version => ({ version })) }),
    );

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'release-check-'));
    mkdirSync(path.join(sandbox, 'bin'));
    stub(
      'npm',
      `echo "npm $* SCHEMA_PATH=$SCHEMA_PATH" >> "$CALLS"
[ "$1" != pack ] || touch "$5/package.tgz"`,
    );
    stub('tar', 'exit 0');
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('stops when the check fails, through its pipe', () => {
    stub('npx', 'echo \'{"passed":false}\'; exit 1');

    const { status } = run(
      stepNamed('Validate the operations against production'),
    );

    expect(status).toBe(1);
  });

  it('passes the report on when the check passes', () => {
    stub('npx', 'echo \'{"passed":true}\'');

    const { status } = run(
      stepNamed('Validate the operations against production'),
    );

    expect(status).toBe(0);
    expect(
      read(path.relative(ROOT, path.join(sandbox, 'release-check.json'))),
    ).toContain('"passed":true');
  });

  it('compiles against every schema production serves', () => {
    report('4.9.6-saaaaaaaaaaaaaaaa', '4.9.7-sbbbbbbbbbbbbbbbb');
    stub('npx', 'echo "npx $*" >> "$CALLS"');

    const { status } = run(
      stepNamed('Compile against each schema production serves'),
    );

    expect(status).toBe(0);
    for (const version of [
      '4.9.6-saaaaaaaaaaaaaaaa',
      '4.9.7-sbbbbbbbbbbbbbbbb',
    ]) {
      expect(calls()).toContain(`pack @muzhaqi16/api-schema@${version}`);
      expect(calls()).toContain(
        `run codegen SCHEMA_PATH=${sandbox}/api-schema-${version}/package/schema.graphql`,
      );
    }
    expect(calls().match(/npx tsc --noEmit\n/g)).toHaveLength(2);
    expect(calls().match(/-p tsconfig\.core\.json/g)).toHaveLength(2);
  });

  it('stops at the first compile that fails', () => {
    report('4.9.6-saaaaaaaaaaaaaaaa', '4.9.7-sbbbbbbbbbbbbbbbb');
    stub('npx', 'echo "npx $*" >> "$CALLS"; exit 2');

    const { status } = run(
      stepNamed('Compile against each schema production serves'),
    );

    expect(status).toBe(2);
    expect(calls()).not.toContain('4.9.7-sbbbbbbbbbbbbbbbb');
  });
});
