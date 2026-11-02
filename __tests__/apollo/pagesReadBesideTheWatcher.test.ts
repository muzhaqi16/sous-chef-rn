import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * A page is asked for only through `fetchPage`, beside the list's watcher. A
 * `fetchMore` runs on the watcher, and Apollo delivers it no cache change until
 * that ends, so a tick made while a page loads would not show.
 */
const ROOT = join(__dirname, '..', '..');

const sourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === '__mocks__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.generated\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

/** Blanks comments: a doc comment may name a call. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

describe('a page of a list', () => {
  it('is never asked for through fetchMore', () => {
    const callers = sourceFiles(join(ROOT, 'src'))
      .filter(file =>
        /\bfetchMore\b/.test(withoutComments(readFileSync(file, 'utf8'))),
      )
      .map(file => relative(ROOT, file));

    expect(callers).toEqual([]);
  });

  it('catches a fetchMore outside a comment', () => {
    expect(withoutComments('await fetchMore({ variables });')).toMatch(
      /\bfetchMore\b/,
    );
    expect(withoutComments('// a `fetchMore` runs on the watcher')).not.toMatch(
      /\bfetchMore\b/,
    );
  });
});
