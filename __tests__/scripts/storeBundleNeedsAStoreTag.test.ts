import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * The API finds store builds by tag, and a suffixed tag is no store version.
 * Each job's own step runs here through bash, as CI runs it. A build from a
 * branch skips this step.
 */

const workflow = (name: string): string =>
  readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', name),
    'utf8',
  );

/** Any version: what reads a tag judges its shape, never its number. */
const VERSION = '1.2.3';

const STORE_TAGS = [
  `refs/tags/playstore-v${VERSION}`,
  `refs/tags/prod-v${VERSION}`,
  `refs/tags/ios-v${VERSION}`,
  `refs/tags/v${VERSION}`,
];

const OTHER_REFS = [
  `refs/tags/dev-v${VERSION}`,
  `refs/tags/stg-v${VERSION}`,
  `refs/tags/playstore-v${VERSION}-rc1`,
];

const jobsBuildingBundles = workflow('build-android.yml')
  .split(/^ {2}build-[a-z-]+:$/m)
  .filter(job => job.includes('IS_PLAYSTORE:'));

const firstStepOf = (job: string): string =>
  job.slice(job.indexOf('    steps:\n')).split(/^ {6}- /m)[1]!;

const scriptOf = (step: string): string =>
  step
    .slice(step.indexOf('run: |\n'))
    .replace('run: |\n', '')
    .replace(/^ {10}/gm, '');

const exitCodeOn = (script: string, ref: string): number | null =>
  spawnSync('bash', ['-c', script], {
    env: { ...process.env, GITHUB_REF: ref },
    encoding: 'utf8',
  }).status;

it('finds both build jobs', () => {
  expect(jobsBuildingBundles).toHaveLength(2);
});

describe.each(jobsBuildingBundles.map(job => [firstStepOf(job)]))(
  'a job building a store bundle',
  step => {
    it('refuses before it checks anything out', () => {
      expect(step).toContain('name: Refuse a store bundle without a store tag');
      expect(step).toContain("if: env.IS_PLAYSTORE == 'true'");
    });

    it.each(STORE_TAGS)('builds from %s', ref => {
      expect(exitCodeOn(scriptOf(step), ref)).toBe(0);
    });

    it.each(OTHER_REFS)('refuses %s', ref => {
      expect(exitCodeOn(scriptOf(step), ref)).toBe(1);
    });
  },
);

describe('the iOS build', () => {
  const [, job = ''] = workflow('build-ios.yml').split(
    /^ {2}build_with_signing:$/m,
  );
  const step = firstStepOf(job);

  it('refuses before anything else runs', () => {
    expect(step).toContain('name: Refuse a build without a store tag');
  });

  it.each([`refs/tags/ios-v${VERSION}`, `refs/tags/v${VERSION}`])(
    'builds from %s',
    ref => {
      expect(exitCodeOn(scriptOf(step), ref)).toBe(0);
    },
  );

  it.each([
    `refs/tags/ios-v${VERSION}-rc1`,
    `refs/tags/v${VERSION}-rc1`,
    'refs/tags/version-note',
  ])('refuses %s', ref => {
    expect(exitCodeOn(scriptOf(step), ref)).toBe(1);
  });
});
