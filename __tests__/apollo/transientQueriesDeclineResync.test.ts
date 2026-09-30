/**
 * A transient query — a search, an analytics view, a preview or lookup driven
 * by what the person typed — declines the client's resync with
 * `refetchOn: false`. Resync re-requests every active watcher on foreground,
 * API reachability and socket reconnect (`src/apollo/refetchEvents.ts`); a
 * search re-run then is a burst that answers a question nobody is asking.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');

/** Searches and analytics by name; the previews and lookups by document. */
const TRANSIENT =
  /^(?:Search\w*|Autocomplete\w*|\w*Analytics|ConvertQuantity|CanConvert|CanDeleteAccount|GetHomeByJoinCode|GetUnitBySymbol|ItemByUpcFilter|ItemBySkuFilter)Document$/;

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

/** The argument list of the call whose `(` is at `open`. */
const callArguments = (source: string, open: number): string => {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) {
      return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
};

const transientCallSites = () => {
  const sites: Array<{ site: string; declines: boolean }> = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\buse(?:Lazy)?Query\(\s*(\w+)/g)) {
      const [call, document] = match;
      if (!document || !TRANSIENT.test(document)) continue;
      const open = match.index + call.indexOf('(');
      sites.push({
        site: `${file.slice(SRC.length + 1)} ${document}`,
        declines: /refetchOn:\s*false/.test(callArguments(source, open)),
      });
    }
  }
  return sites;
};

describe('transient queries', () => {
  const sites = transientCallSites();

  it('finds the transient call sites', () => {
    expect(sites.length).toBeGreaterThan(10);
  });

  it('decline resync with refetchOn: false', () => {
    expect(sites.filter(({ declines }) => !declines).map(s => s.site)).toEqual(
      [],
    );
  });
});
