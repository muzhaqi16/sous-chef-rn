import { spawnSync } from 'child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A promotion writes Play's release notes through this script, so it runs here
 * for real: against today's listing, which must always be sendable, and
 * against copies broken one way at a time.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(
  ROOT,
  'scripts',
  'store-listing',
  'play-release-notes.mjs',
);
const LISTING = path.join(ROOT, 'scripts', 'store-listing', 'listing.json');

interface Listing {
  _playReleaseNotesFor: string;
  _storeLanguages: { play: Record<string, string[] | string> };
  [language: string]: unknown;
}

const listing = (): Listing =>
  JSON.parse(readFileSync(LISTING, 'utf8')) as Listing;

const notesOf = (copy: Listing, language: string) =>
  (copy[language] as { play: { releaseNotes?: string } }).play;

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'play-notes-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const run = (version: string, copy?: Listing, code = '216') => {
  const args = ['--version', version, '--code', code, '--out', sandbox];
  if (copy) {
    const file = path.join(sandbox, 'listing.json');
    writeFileSync(file, JSON.stringify(copy));
    args.push('--listing', file);
  }
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
};

const changelog = (locale: string, code = '216') =>
  readFileSync(path.join(sandbox, locale, 'changelogs', `${code}.txt`), 'utf8');

describe("today's listing", () => {
  const today = listing();

  it('can be sent for the version it is recorded for', () => {
    expect(run(today._playReleaseNotesFor).status).toBe(0);
  });

  it('gives every mapped Play locale its language’s notes', () => {
    run(today._playReleaseNotesFor);

    for (const [language, locales] of Object.entries(
      today._storeLanguages.play,
    )) {
      for (const locale of Array.isArray(locales) ? locales : []) {
        expect(changelog(locale)).toBe(notesOf(today, language).releaseNotes);
      }
    }
    expect(changelog('es-419')).toBe(changelog('es-US'));
  });

  it('writes nothing for a language Play does not list', () => {
    const copy = listing();
    copy._storeLanguages.play.sq = 'pending: no Albanian listing language';

    expect(run(copy._playReleaseNotesFor, copy).status).toBe(0);
    expect(readdirSync(sandbox)).not.toContain('sq');
  });
});

describe('a promotion it refuses', () => {
  it('names the version the notes are for', () => {
    const { status, stderr } = run('99.0.0');

    expect(status).toBe(1);
    expect(stderr).toContain(
      `notes are for ${listing()._playReleaseNotesFor}, not 99.0.0`,
    );
  });

  it('names a language over Play’s 500 characters', () => {
    const copy = listing();
    notesOf(copy, 'it').releaseNotes = 'x'.repeat(501);

    const { status, stderr } = run(copy._playReleaseNotesFor, copy);

    expect(status).toBe(1);
    expect(stderr).toContain("it: 501 characters, over Play's 500");
  });

  it('names a language with no notes', () => {
    const copy = listing();
    delete notesOf(copy, 'sq').releaseNotes;

    const { status, stderr } = run(copy._playReleaseNotesFor, copy);

    expect(status).toBe(1);
    expect(stderr).toContain('sq: no Play release notes');
  });

  it('takes only a numeric version code', () => {
    const { status, stderr } = run(
      listing()._playReleaseNotesFor,
      undefined,
      'latest',
    );

    expect(status).toBe(1);
    expect(stderr).toContain('--code must be a version code');
  });

  it('writes no file when it refuses', () => {
    run('99.0.0');

    expect(readdirSync(sandbox)).toEqual([]);
  });
});
