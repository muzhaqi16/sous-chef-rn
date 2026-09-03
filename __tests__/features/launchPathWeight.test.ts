import fs from 'fs';
import path from 'path';

/**
 * `i18n/config` is imported near the top of `index.js`, so everything it
 * reaches is evaluated before the first frame.
 *
 * It reads the static feature registry for locale trees, and iterating that
 * array loads EVERY manifest module — so anything a manifest carries becomes
 * launch cost. Putting the cache type policies on a manifest took this from 64
 * modules to 213 and dragged `cacheFieldPolicies` → the offline queue store →
 * telemetry → the Zustand store → `apollo/client` in with it. Nothing failed;
 * the only visible symptom was a `deviceLocale` mock that stopped applying,
 * because the module had already been evaluated during jest setup.
 *
 * The registries are split by CONSUMER for that reason: `registry.static.ts`
 * carries what i18n needs, `registry.cache.ts` what `makeCache()` needs, and
 * `offlineQueue/syncRegistry.ts` what the queue needs.
 */

const ROOT = path.join(__dirname, '..', '..');
const ENTRY = path.join(ROOT, 'src', 'i18n', 'config.ts');

const ALIASES: Record<string, string> = {
  '#features': 'src/features',
  '#components': 'src/components',
  '#hooks': 'src/hooks',
  '#store': 'src/store',
  '#utils': 'src/utils',
  '#services': 'src/services',
  '#constants': 'src/constants',
  '#apollo': 'src/apollo',
  '#storage': 'src/storage',
  '#operations': 'src/graphql/operations',
  '#generated': 'src/graphql/generated',
  '#': 'src',
};

const IMPORT_SOURCE = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

const resolve = (spec: string, from: string): string | null => {
  let base: string;
  if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(from), spec);
  } else {
    const alias = Object.keys(ALIASES)
      .sort((a, b) => b.length - a.length)
      .find(a => spec === a || spec.startsWith(`${a}/`));
    if (!alias) return null;
    base = path.join(ROOT, ALIASES[alias], spec.slice(alias.length));
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    path.join(base, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
};

const reachable = (entry: string): Set<string> => {
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (file.endsWith('.json')) continue;
    for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(IMPORT_SOURCE)) {
      const next = resolve(spec, file);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};

describe('the i18n launch path', () => {
  const reached = reachable(ENTRY);
  const reaches = (rel: string) => reached.has(path.join(ROOT, rel));

  it('resolves the graph at all, so the checks below are not vacuous', () => {
    expect(reached.size).toBeGreaterThan(20);
    expect(reaches('src/features/registry.static.ts')).toBe(true);
  });

  it.each([
    ['the Apollo client', 'src/apollo/client.ts'],
    ['the Zustand store', 'src/store/index.ts'],
    ['the offline queue store', 'src/apollo/offlineQueue/queueStore.ts'],
    ['the cache field policies', 'src/apollo/cacheFieldPolicies.ts'],
    ['the sync registry', 'src/apollo/offlineQueue/syncRegistry.ts'],
    ['device locale probing', 'src/utils/deviceLocale.ts'],
  ])('does not reach %s', (_label, rel) => {
    expect(reaches(rel)).toBe(false);
  });

  it('stays roughly the size it is, so a new manifest field is noticed', () => {
    // Not a performance budget — a tripwire. If this grows, something was added
    // to a manifest that only a later consumer needs.
    expect(reached.size).toBeLessThanOrEqual(90);
  });
});
