import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every testID an e2e spec looks for exists somewhere in the app.
 *
 * This bug class has now bitten three times, and each instance cost a full
 * Detox run to discover — the element simply never appears and the test times
 * out, minutes later, with no indication that the ID was fictional:
 *
 *   - `e2e/screens/BaseScreen.ts` used `back-button`; the app renders
 *     `header-back-button` (fixed under task 1.9).
 *   - `e2e/screens/ShoppingListScreen.ts` used
 *     `add-shopping-add-manually-button`; the sheet builds
 *     `add-shopping-item-add-manually-button` from its config prefix.
 *   - `e2e/screens/PantryScreen.ts` used `add-pantry-add-manually-button`;
 *     the real one is `add-pantry-item-add-manually-button`.
 *
 * The audit under task 3.7 missed the last two because a grep for the literal
 * string finds nothing either way: those IDs are built at runtime as
 * `` `${config.testIDPrefix}-add-manually-button` ``. Worse, the AddItemSheet
 * unit test had invented `testIDPrefix: 'add-pantry'` — a prefix no production
 * config uses — so it passed while asserting IDs the app never renders, and the
 * e2e was written against those.
 *
 * So this resolves the template forms rather than grepping for literals, and
 * runs in the unit suite where it costs milliseconds instead of a device run.
 */
// Lives outside any `e2e` path segment: jest.config ignores those, so a file
// under `__tests__/e2e/` is silently never run.
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const E2E = join(ROOT, 'e2e');

const walk = (dir: string, match: RegExp, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'artifacts' || entry === 'node_modules') continue;
      walk(full, match, out);
    } else if (match.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

/**
 * testIDs the app can render.
 *
 * Deliberately a SUPERSET: every kebab-case string literal anywhere in `src`,
 * plus the config-built and prefix forms. Narrower extraction was tried first
 * and produced false alarms — `edit-item-submit-button` sits inside a
 * multi-line ternary, and `login-submit-button` is passed as
 * `submitButtonTestID`, so neither is adjacent to the token `testID`.
 *
 * A guard that cries wolf gets muted, and the cost here is asymmetric: missing
 * a stale id means one Detox test still fails the slow way, which is the status
 * quo; a false alarm means nobody trusts the check. So it errs toward silence
 * and every failure it does report is real.
 */
const appTestIds = (): { exact: Set<string>; prefixes: string[] } => {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  const files = walk(SRC, /\.tsx?$/);

  // Every `testIDPrefix` the app declares — as a config field OR as a JSX prop.
  // Both forms exist: `testIDPrefix: 'add-pantry-item'` in a sheet config, and
  // `testIDPrefix="pantry-location-tab"` on <FilterTabs>. The latter renders
  // `` `${testIDPrefix}-${tab.id}` ``, where the suffix is data, so the prefix
  // is the most that can be resolved statically.
  const configPrefixes = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/testIDPrefix:\s*'([^']+)'/g)) {
      configPrefixes.add(m[1]);
    }
    for (const m of source.matchAll(/testIDPrefix=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
      const prefix = m[1] ?? m[2];
      configPrefixes.add(prefix);
      prefixes.push(prefix);
    }
  }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    // Any kebab-case string literal. See the docblock for why this is broad.
    for (const m of source.matchAll(/['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"`]/g)) {
      exact.add(m[1]);
    }

    for (const m of source.matchAll(
      /testID=\{`\$\{config\.testIDPrefix\}-([a-z0-9-]+)`\}/g,
    )) {
      for (const prefix of configPrefixes) exact.add(`${prefix}-${m[1]}`);
    }

    for (const m of source.matchAll(/testID=\{`([a-z][a-z0-9-]*)-\$\{/g)) {
      prefixes.push(m[1]);
    }
  }

  return { exact, prefixes };
};

/** testIDs the e2e layer looks for. */
const referencedTestIds = (): Array<{ id: string; where: string }> => {
  const refs: Array<{ id: string; where: string }> = [];
  for (const file of walk(E2E, /\.ts$/)) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const m of source.matchAll(/by\.id\(\s*'([^']+)'\s*\)/g)) {
      const line = source.slice(0, m.index).split('\n').length;
      refs.push({ id: m[1], where: `${rel}:${line}` });
    }
  }
  return refs;
};

/**
 * testIDs the e2e layer looks for that the app does not render.
 *
 * EMPTY, and it should stay that way. This started at 26 entries across 6
 * files — ids for controls that had been renamed, for sheets the app never
 * showed, and for flows whose controls carried no testID at all. Every one is
 * now either fixed, given a testID in the app, or deleted along with the dead
 * helper that referenced it.
 *
 * Adding an entry here is a deliberate admission of debt, not a way to quiet
 * the check. The rot test below then forces it back out the moment it is fixed.
 */
const KNOWN_MISSING = new Set<string>([]);

describe('e2e testIDs exist in the app', () => {
  const { exact, prefixes } = appTestIds();
  const refs = referencedTestIds();

  it('finds testIDs on both sides, so the check is not vacuous', () => {
    expect(exact.size).toBeGreaterThan(100);
    expect(refs.length).toBeGreaterThan(20);
  });

  it('resolves config-built testIDs, which a literal grep cannot see', () => {
    // The exact shape that hid two of the three known instances.
    expect(exact.has('add-pantry-item-add-manually-button')).toBe(true);
    expect(exact.has('add-shopping-item-add-manually-button')).toBe(true);
    // …and the fictional prefix is NOT resolvable.
    expect(exact.has('add-pantry-add-manually-button')).toBe(false);
  });

  const unresolved = () =>
    refs
      .filter(({ id }) => !exact.has(id))
      .filter(({ id }) => !prefixes.some(p => id.startsWith(`${p}-`)));

  it('no NEW id is referenced that the app cannot render', () => {
    const added = unresolved()
      .filter(({ id }) => !KNOWN_MISSING.has(id))
      .map(({ id, where }) => `${id}  (${where})`);

    expect([...new Set(added)]).toEqual([]);
  });

  it('every known-missing id is still missing, so the list cannot rot', () => {
    // Fixing one has to delete its entry. Otherwise the list slowly becomes
    // cover for ids that are fine, and stops meaning anything.
    const stillMissing = new Set(unresolved().map(r => r.id));
    const fixed = [...KNOWN_MISSING].filter(id => !stillMissing.has(id));

    expect(fixed).toEqual([]);
  });
});
