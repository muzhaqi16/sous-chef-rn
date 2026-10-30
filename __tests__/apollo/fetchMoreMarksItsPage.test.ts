import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every `fetchMore` page is marked `context: { page: true }`, so the
 * precedence link never answers it from the list the cache already merged
 * (the `sync/local-write-precedence` page requirement). Pages are asked for
 * only in `src/hooks/utils/`, which marks them.
 */
const ROOT = join(__dirname, '..', '..');
const HOME = join('src', 'hooks', 'utils');

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

/** Blanks comments, keeping line numbers: a doc comment may show a call. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, comment =>
    comment.replace(/[^\n]/g, ' '),
  );

/** The line of each `fetchMore(` call in `source` that sends no page mark. */
const unmarkedCalls = (raw: string): number[] => {
  const source = withoutComments(raw);
  const lines: number[] = [];
  for (const match of source.matchAll(/\bfetchMore\(/g)) {
    let depth = 0;
    let end = match.index;
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')' && --depth === 0) break;
    }
    if (!/\bpage:\s*true\b/.test(source.slice(match.index, end))) {
      lines.push(source.slice(0, match.index).split('\n').length);
    }
  }
  return lines;
};

const callers = sourceFiles(join(ROOT, 'src'))
  .map(file => ({
    file: relative(ROOT, file),
    source: readFileSync(file, 'utf8'),
  }))
  .filter(({ source }) => /\bfetchMore\(/.test(withoutComments(source)));

describe('a fetchMore page is marked for the precedence link', () => {
  it('is asked for only in src/hooks/utils', () => {
    expect(callers.length).toBeGreaterThan(0);
    expect(
      callers.filter(({ file }) => !file.startsWith(HOME)).map(c => c.file),
    ).toEqual([]);
  });

  it('marks every page it asks for', () => {
    expect(
      callers.flatMap(({ file, source }) =>
        unmarkedCalls(source).map(line => `${file}:${line}`),
      ),
    ).toEqual([]);
  });

  it('catches an unmarked call', () => {
    expect(unmarkedCalls('await fetchMore({ variables });')).toEqual([1]);
    expect(
      unmarkedCalls('await fetchMore({ variables, context: { page: true } });'),
    ).toEqual([]);
  });
});
