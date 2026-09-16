/**
 * A write the offline queue can take must make its change locally first.
 *
 * `queueLink` queues a mutation when it carries `localFirst` OR its operation
 * is in `SYNC_REGISTRY`. A sync-mapped write whose caller skips the local write
 * is queued anyway, settles `queued`, and shows nothing: the sheet closes, the
 * list keeps the old value, and a restart has nothing to restore. The quantity
 * sheet shipped exactly that. `localFirst: true` on the call is the house marker
 * that the caller wrote the cache before firing, so every call must carry it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { SYNC_REGISTRY } from '#/apollo/offlineQueue/syncRegistry';

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === '__mocks__'
        ? []
        : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) && !name.endsWith('.generated.ts')
      ? [path]
      : [];
  });
}

/** The text of the balanced `(…)` group opening at `open`. */
function group(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open);
}

/**
 * A call passing its options as one identifier, `fire(options)`, is checked
 * against that `const options = {…}` in the same file.
 */
function resolveOptions(source: string, call: string): string {
  const name = /^\(\s*(\w+)\s*\)$/.exec(call)?.[1];
  if (!name) return call;
  const declaration = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\{`).exec(
    source,
  );
  if (!declaration) return call;
  const open = declaration.index + declaration[0].length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return call;
}

const uncommented = (text: string) =>
  text.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');

interface CallSite {
  where: string;
  call: string;
}

/** Every call that fires one of `documents`, with the text of its arguments. */
function callSites(file: string, documents: string[]): CallSite[] {
  const source = readFileSync(file, 'utf8');
  const sites: CallSite[] = [];
  const lineOf = (index: number) => source.slice(0, index).split('\n').length;
  const where = (index: number) => `${relative(ROOT, file)}:${lineOf(index)}`;

  for (const document of documents) {
    // `const [fire] = useMutation(XDocument` — every `fire(…)` is a call site.
    const hook = new RegExp(
      `const\\s*\\[\\s*(\\w+)[^\\]]*\\]\\s*=\\s*useMutation\\(\\s*${document}\\b`,
      'g',
    );
    for (const match of source.matchAll(hook)) {
      const fire = match[1];
      if (!fire) continue;
      const invocation = new RegExp(`(?<![\\w.])${fire}\\(`, 'g');
      for (const call of source.matchAll(invocation)) {
        const open = call.index + call[0].length - 1;
        sites.push({
          where: where(call.index),
          call: resolveOptions(source, group(source, open)),
        });
      }
    }
    // `client.mutate({ mutation: XDocument, … })`, within that one call.
    const names = new RegExp(`mutation:\\s*${document}\\b`);
    for (const match of source.matchAll(/\.mutate\(/g)) {
      const call = group(source, match.index + match[0].length - 1);
      if (names.test(call)) sites.push({ where: where(match.index), call });
    }
  }
  return sites;
}

describe('a write the offline queue can take is local-first', () => {
  const documents = Object.keys(SYNC_REGISTRY).map(op => `${op}Document`);
  const sites = sourceFiles(join(ROOT, 'src'))
    // The queue itself builds and replays these; it is not a caller.
    .filter(file => !file.includes(join('src', 'apollo', 'offlineQueue')))
    .flatMap(file => callSites(file, documents));

  it('finds the call sites it guards', () => {
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  // Apollo drops an optimistic layer when the mutation completes, and a queued
  // write completes at once with a null result: the change flashes and vanishes.
  it('never pairs an optimisticResponse with a localFirst call', () => {
    const paired = sourceFiles(join(ROOT, 'src')).flatMap(file => {
      const source = readFileSync(file, 'utf8');
      const hooks = /const\s*\[\s*(\w+)[^\]]*\]\s*=\s*useMutation\(/g;
      return [...source.matchAll(hooks)].flatMap(match => {
        const fire = match[1];
        if (!fire) return [];
        const options = group(source, match.index + match[0].length - 1);
        const invocation = new RegExp(`(?<![\\w.])${fire}\\(`, 'g');
        return [...source.matchAll(invocation)]
          .map(call => ({
            index: call.index,
            args: resolveOptions(
              source,
              group(source, call.index + call[0].length - 1),
            ),
          }))
          .filter(
            ({ args }) =>
              /localFirst:\s*true/.test(args) &&
              /\boptimisticResponse\s*[:,}]/.test(uncommented(options + args)),
          )
          .map(
            ({ index }) =>
              `${relative(ROOT, file)}:${
                source.slice(0, index).split('\n').length
              }`,
          );
      });
    });
    expect(paired).toEqual([]);
  });

  it('marks every call to a sync-mapped mutation localFirst', () => {
    const unmarked = sites
      .filter(site => !/localFirst:\s*true/.test(site.call))
      .map(site => site.where);
    expect(unmarked).toEqual([]);
  });
});
