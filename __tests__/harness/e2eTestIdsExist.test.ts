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
 *
 * WHAT THIS CANNOT SEE. A prefix declared as a prop — `testIDPrefix="shopping-list-item"`
 * — licenses `shopping-list-item-<anything>`, because the id it renders is
 * `shopping-list-item-${itemId}` and an item id is a runtime value. That makes
 * `shopping-list-item-delete` indistinguishable from a legitimate id here, even
 * though the app renders `shopping-list-item-<id>-delete` (the swipe actions
 * append `-delete` / `-edit` to a prefix that ALREADY ends in the item id). A
 * spec written against the short form finds nothing and times out on device.
 *
 * The rule that follows from that: match swipe-action ids with a REGEX that
 * requires the middle segment — `by.id(/^shopping-list-item-.+-delete$/)` — not
 * a literal. Both CRUD specs now do.
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
/** Fixtures and mocks render invented ids; they are not app render sites. */
const isTestFile = (file: string): boolean =>
  file.includes('__tests__') || /\.test\.tsx?$/.test(file);

const appTestIds = (): {
  exact: Set<string>;
  prefixes: string[];
  shapes: RegExp[];
  collapsed: Set<string>;
} => {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  const shapes: RegExp[] = [];
  /**
   * Ids that are a real template with its DYNAMIC SEGMENT DROPPED.
   *
   * `` testID={`shopping-list-item-${itemId}-delete`} `` means the app renders
   * `shopping-list-item-<id>-delete` and never `shopping-list-item-delete`. The
   * second is the recurring typo — a spec writes the two literal halves and
   * forgets the id in the middle. Structurally it is indistinguishable from a
   * real id (`shopping-list-item-abc123` has the same shape), which is why the
   * `prefixes` waiver below lets it through and why it needs naming explicitly.
   *
   * Derived from the templates themselves, so it costs nothing to maintain and
   * cannot go stale: rename the id and the collapsed form moves with it.
   */
  const collapsed = new Set<string>();
  const files = walk(SRC, /\.tsx?$/);

  // Every `testIDPrefix` the app declares — as a config field OR as a JSX prop.
  // Both forms exist: `testIDPrefix: 'add-pantry-item'` in a sheet config, and
  // `testIDPrefix="pantry-location-tab"` on <FilterTabs>. The latter renders
  // `` `${testIDPrefix}-${tab.id}` ``, where the suffix is data, so the prefix
  // is the most that can be resolved statically.
  const configPrefixes = new Set<string>();
  for (const file of files) {
    // Same reason as the scan below, and it bites harder here. A prefix waives
    // EVERY id beneath it, so a prefix invented by a fixture licenses a whole
    // namespace of ids the app never renders: `ListTemplate.test.tsx` declares
    // `testIDPrefix="pantry"`, which waived `pantry-item-1-quantity` — an
    // index-keyed id the app does not render — and `FilterTabs.test.tsx`
    // declares `location`. Both are fixtures. Neither is a render site.
    if (isTestFile(file)) continue;

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
    // Unit tests and their mocks are not app render sites. `splash-screen`
    // existed ONLY as a testID on a stub inside `RootNavigator.test.tsx`, and
    // because this scan read that file, the id counted as "the app renders it"
    // — which let `smoke.e2e.ts` assert the splash screen goes away when the
    // app has never rendered one. That assertion passed unconditionally for as
    // long as it existed.
    if (isTestFile(file)) continue;

    const source = readFileSync(file, 'utf8');

    // Any kebab-case string literal. See the docblock for why this is broad.
    for (const m of source.matchAll(/['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"`]/g)) {
      exact.add(m[1]);
    }

    // `${config.testIDPrefix}-add-manually-button` and `${testIDPrefix}-delete`
    // resolve to CONCRETE ids, because every prefix the app declares is known.
    // Expanding them is what lets `add-shopping-item-add-manually-button` be
    // recognised while `add-shopping-add-manually-button` — the recurring typo
    // this file was written for — is not.
    for (const m of source.matchAll(
      /testID=\{`\$\{(?:config\.)?testIDPrefix\}-([a-z0-9-]+)`\}/g,
    )) {
      for (const prefix of configPrefixes) exact.add(`${prefix}-${m[1]}`);
    }

    // Whole template SHAPES, not bare prefixes.
    //
    // `` testID={`shopping-list-item-${id}-delete`} `` has to license
    // `shopping-list-item-<something>-delete` and NOT `shopping-list-item-delete`
    // — the app never renders the latter, because the item id sits in the
    // middle. Recording only the leading `shopping-list-item` and excusing
    // everything under it waved through exactly the ids this file exists to
    // catch: `shopping-list-item-edit`, `shopping-list-item-delete` and
    // `add-shopping-add-manually-button` were all referenced by a spec, all
    // fictional, and all reported green here while each cost a full Detox run
    // to discover.
    //
    // Each `${…}` becomes `.+`, so a dynamic segment must actually be present.
    // A template becomes a SHAPE only when it pins down enough to be worth
    // anything. Two rules, both learned the hard way:
    //
    //   - `` `${testIDPrefix}-${tab.id}` `` is nothing but interpolations and a
    //     separator, so it compiles to `^.+-.+$` — which matches essentially
    //     every kebab-case id in the app. A single template of that shape
    //     silently licensed EVERY unresolved id, turning this whole file green
    //     while the ids it exists to catch sailed through. So a shape needs a
    //     real literal segment, not just punctuation.
    //   - Templates whose interpolation IS a declared prefix are expanded into
    //     concrete ids above; re-adding them here as `.+` would only widen what
    //     the expansion already covers exactly.
    // Both the bare form `` testID={`a-${b}`} `` and the conditional one
    // `` testID={cond ? `a-${b}` : undefined} ``. Only the bare form used to be
    // read, so `alert-button-${index}` in `AlertProvider` was invisible here and
    // the spec's `alert-button-0` passed only because the id also appeared,
    // backtick-quoted, in a comment two lines above — which the literal scan
    // picks up. Deleting that prose failed this test on a testID that renders.
    for (const m of source.matchAll(
      /testID=\{(?:[^`{}]*\?\s*)?`([^`]+)`/g,
    )) {
      const template = m[1];
      if (!template.includes('${')) continue;
      if (/\$\{(?:config\.)?testIDPrefix\}/.test(template)) continue;

      const literals = template.split(/\$\{[^}]*\}/);
      const anchored = literals.some(part => /[a-z]{3}/.test(part));
      if (!anchored) continue;

      const pattern = literals
        .map(literal => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.+');
      shapes.push(new RegExp(`^${pattern}$`));

      // One interpolation with a literal either side — the only form that has
      // an unambiguous collapsed twin.
      if (literals.length === 2) {
        const head = literals[0].replace(/-$/, '');
        const tail = literals[1].replace(/^-/, '');
        if (head && tail) collapsed.add(`${head}-${tail}`);
      }
    }
  }

  // `SheetFormHeader` derives its cancel id from the submit id it was given:
  //
  //     cancelTestID ?? `${submitTestID.replace(/-submit-button$/, '')}-cancel-button`
  //
  // so `add-pantry-item-submit-button` renders a real, tappable
  // `add-pantry-item-cancel-button` that appears nowhere as a literal. Mirrored
  // here rather than exempted, because it is a rule the app actually follows —
  // an exemption would also hide a genuinely wrong cancel id.
  for (const id of [...exact]) {
    if (id.endsWith('-submit-button')) {
      exact.add(`${id.replace(/-submit-button$/, '')}-cancel-button`);
    }
  }

  return { exact, prefixes, shapes, collapsed };
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
  const { exact, prefixes, shapes, collapsed } = appTestIds();
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
    refs.filter(({ id }) => {
      // A collapsed form is never waived. It is exactly the id the waivers
      // below would wave through — it shares its prefix with the real template
      // and differs from a genuine id only in what the dropped segment held —
      // so it has to be answered before them, not after.
      if (collapsed.has(id)) return true;

      if (exact.has(id)) return false;
      if (prefixes.some(prefix => id.startsWith(`${prefix}-`))) return false;
      if (shapes.some(shape => shape.test(id))) return false;
      return true;
    });

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
