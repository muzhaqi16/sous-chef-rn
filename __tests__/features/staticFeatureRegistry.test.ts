import fs from 'fs';
import path from 'path';

/**
 * The static registry is what the APP SHELL iterates — i18n init, the cache's
 * type policies, the offline queue's sync builders, push routing, session
 * teardown. Every one of those runs on the launch path, and `i18n/config` is
 * imported near the top of `index.js`.
 *
 * So the property that matters is not "the registry is complete" but "loading
 * it loads no UI". The screen-bearing `FEATURE_REGISTRY` pulls the whole
 * component graph in with it, which is why feature locales were a hand-kept
 * import block rather than a registry read in the first place.
 *
 * Checked on the import GRAPH from disk rather than at runtime: a module that
 * only a `React.lazy` reaches would evaluate late and pass a runtime probe
 * while still being in the bundle's launch chunk.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const ENTRY = path.join(SRC, 'features', 'registry.static.ts');

const ALIASES: Record<string, string> = {
  '#features': path.join(SRC, 'features'),
  '#components': path.join(SRC, 'components'),
  '#hooks': path.join(SRC, 'hooks'),
  '#store': path.join(SRC, 'store'),
  '#utils': path.join(SRC, 'utils'),
  '#navigation': path.join(SRC, 'navigation'),
  '#operations': path.join(SRC, 'graphql', 'operations'),
  '#generated': path.join(SRC, 'graphql', 'generated'),
  '#': SRC,
};

const IMPORT_SOURCE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/** Resolve a specifier to a file under `src/`, or null when it leaves the tree. */
const resolve = (spec: string, fromFile: string): string | null => {
  let base: string | null = null;
  if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    const alias = Object.keys(ALIASES)
      .sort((a, b) => b.length - a.length)
      .find(a => spec === a || spec.startsWith(`${a}/`));
    if (!alias) return null;
    base = path.join(ALIASES[alias], spec.slice(alias.length));
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
};

/** Every module the entry reaches, transitively. */
const reachableFrom = (entry: string): string[] => {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || file.endsWith('.json')) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(IMPORT_SOURCE)) {
      const next = resolve(spec, file);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
};

const featureDirs = () =>
  fs
    .readdirSync(path.join(SRC, 'features'), { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();

describe('static feature registry', () => {
  const reached = reachableFrom(ENTRY).map(f => path.relative(ROOT, f));

  it('reaches every static manifest, so the checks below are not vacuous', () => {
    const manifests = reached.filter(f => f.endsWith('manifest.static.ts'));
    expect(manifests.length).toBe(featureDirs().length);
  });

  it('loads no screen and no component', () => {
    // A `.generated.ts` colocated under `screens/` or `components/` is a typed
    // DocumentNode with no React in it — the same distinction
    // `check-data-layer-boundary` draws when it TRACKS operation types rather
    // than failing them. Loading one costs nothing; loading a screen costs the
    // component graph.
    const ui = reached.filter(
      f =>
        /(^|\/)(screens|components|ui)(\/|$)/.test(f) &&
        !f.endsWith('.generated.ts'),
    );
    expect(ui).toEqual([]);
  });

  it('pulls in no React at all, which is the property behind that', () => {
    const withReact = reached.filter(f => {
      const source = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return /\bfrom 'react'|\bfrom "react"|React\./.test(source);
    });
    expect(withReact).toEqual([]);
  });

  it('loads no navigator', () => {
    expect(reached.filter(f => f.includes('/navigation/'))).toEqual([]);
  });

  it('covers every feature that ships copy', () => {
    // A feature with a locales/ directory but no registry entry renders raw
    // keys: the i18n gates read the filesystem, the app reads the registry.
    const withLocales = featureDirs().filter(name =>
      fs.existsSync(path.join(SRC, 'features', name, 'locales')),
    );
    const declared = withLocales.filter(name => {
      const manifest = path.join(SRC, 'features', name, 'manifest.static.ts');
      return (
        fs.existsSync(manifest) &&
        fs.readFileSync(manifest, 'utf8').includes('locales')
      );
    });
    expect(declared).toEqual(withLocales);
  });

  it('every feature has a static manifest the registry lists', () => {
    const registry = fs.readFileSync(ENTRY, 'utf8');
    for (const name of featureDirs()) {
      expect(registry).toContain(`./${name}/manifest.static`);
    }
  });
});
