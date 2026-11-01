import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * An alert reports a failure or asks a question, so one that only tells is
 * trouble: no rating request follows it soon. News goes in a toast, or a person
 * who just succeeded loses their chance to be asked.
 */
const SRC = join(__dirname, '..', '..');

const NEWS_KEY =
  /^success\.|Success(Body)?$|^labels\.(done|copied)$|\.(sent|updated)(Title|Body)$/;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === '__mocks__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.generated\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

/** The title and body of each `alertService.alert(...)` call in `source`. */
const alertCopy = (source: string): string[] =>
  [...source.matchAll(/alertService\.alert\(/g)].map(({ index }) => {
    const start = index + 'alertService.alert('.length;
    let depth = 0;
    let commas = 0;
    let at = start;
    // A confirm's buttons follow, whose callbacks may speak for themselves.
    while (commas < 2 && depth >= 0 && at < source.length) {
      const char = source.charAt(at);
      if ('([{'.includes(char)) depth += 1;
      if (')]}'.includes(char)) depth -= 1;
      if (char === ',' && depth === 0) commas += 1;
      at += 1;
    }
    return source.slice(start, at);
  });

describe('an alert', () => {
  it('never carries news', () => {
    const news = walk(SRC).flatMap(file =>
      alertCopy(readFileSync(file, 'utf8')).flatMap(copy =>
        [...copy.matchAll(/t(?:Global)?\(\s*'([^']+)'/g)]
          .map(([, key]) => key ?? '')
          .filter(key => NEWS_KEY.test(key))
          .map(key => `${relative(SRC, file)}: ${key}`),
      ),
    );

    expect(news).toEqual([]);
  });
});
