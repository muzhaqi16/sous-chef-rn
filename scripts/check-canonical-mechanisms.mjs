#!/usr/bin/env node
/**
 * Fails when a file reaches for an alternative to a documented canonical
 * mechanism.
 *
 * ## Why a script rather than lint rules
 *
 * Every concern here COULD be a `no-restricted-imports` entry, and the ones
 * that reach zero should become one. Today they carry 80-odd outliers between
 * them, and expressing those in `.eslintrc.js` means an `overrides` block per
 * concern plus a matching entry in `restrictedImportsAreNotDropped.test.ts` —
 * roughly 300 lines of allowlist guarding 300 lines of rule, in a config whose
 * own docblock warns that an override silently replaces what it does not
 * restate.
 *
 * One baseline per concern says the same thing in a form that can only shrink,
 * and the promotion path is explicit: when a concern's list empties, delete it
 * here and add the ban to `RESTRICTED_IMPORT_PATHS`, where ESLint will keep it
 * at zero for free.
 *
 * ## What each concern is
 *
 * Not style. Each alternative loses something the canonical path already
 * solved — a theme that follows the colour scheme, a locale that follows the
 * language, a scroll container that arbitrates gestures, a permission prompt
 * that handles the twice-denied case.
 *
 *   node scripts/check-canonical-mechanisms.mjs           # check
 *   node scripts/check-canonical-mechanisms.mjs --list    # print every finding
 *   node scripts/check-canonical-mechanisms.mjs --update  # re-baseline
 *   node scripts/check-canonical-mechanisms.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  baselineFile,
  diffSets,
  filesUnder,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-canonical-mechanisms.baseline.json'),
);

const SCAN_GLOBS = ['src/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /\.d\.ts$/,
];

/** A named import of `name` from `module`. */
const importsName = (module, name) =>
  new RegExp(
    `import\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${module}['"]`,
  );

/**
 * Each concern: what the canonical mechanism is, what an alternative looks
 * like, and which files are allowed to hold the alternative because they ARE
 * the canonical mechanism.
 */
export const CONCERNS = [
  {
    id: 'list-primitive',
    canonical: 'FlashList, with an explicit renderScrollComponent',
    why: 'RN lists do not participate in the gesture arbitration the swipeable rows need.',
    // A `pagingEnabled` horizontal list is a PAGER, not a row list: it has no
    // rows to recycle and no row gestures to arbitrate, and it depends on
    // `getItemLayout` + native paging, which FlashList v2 computes itself.
    // CLAUDE.md's own rule is not to move a list to FlashList speculatively.
    detect: source =>
      importsName('react-native', '(FlatList|SectionList)').test(source) &&
      !/pagingEnabled/.test(source),
    owns: [],
  },
  {
    id: 'image-component',
    canonical:
      'CachedImage for a remote url, LocalImage for a file or bundled asset',
    why: 'The wrappers own caching, the recycling key and the placeholder.',
    // The RENDERED element, not the import: `Image.getSize()` measures a file
    // and draws nothing, so it has no caching or placeholder to get wrong.
    // `Animated.Image` reaches the same RN component without naming it in an
    // import, so it is matched on the element instead.
    detect: source =>
      (importsName('react-native', 'Image').test(source) &&
        /<Image[\s/>]/.test(source)) ||
      /<Animated\.Image[\s/>]/.test(source),
    owns: [
      /^src\/components\/atoms\/CachedImage\.tsx$/,
      /^src\/components\/atoms\/LocalImage\.tsx$/,
    ],
  },
  {
    id: 'modal-surface',
    canonical: 'BottomSheetModal via useStandardBottomSheet, or alertService',
    why: "A transparent RN Modal that dims nothing leaves the tab bar lit under it — RN's Modal does not claim the global backdrop.",
    // The harm is the UNDIMMED surface, not the import. A modal that paints its
    // own full-bleed overlay, or is opaque, covers what the global backdrop
    // would have; one that is transparent and dims nothing does not. Choosing
    // a bottom sheet over a centred dialog is a design decision this gate has
    // no business making — it checks the defect it names.
    detect: source =>
      importsName('react-native', 'Modal').test(source) &&
      /<Modal[\s\S]{0,400}?\btransparent\b(?!=\{false\})/.test(source) &&
      !/(overlays\.|backdrop|Backdrop)/.test(source),
    owns: [
      /^src\/components\/providers\/AlertProvider\.tsx$/,
      /^src\/components\/organisms\/SpotlightCoachMark\//,
      /^src\/components\/molecules\/FormSelect\.tsx$/,
    ],
  },
  {
    id: 'date-formatting',
    canonical:
      'the shared formatters in src/utils (formatters/date, dateUtils)',
    why: 'A direct format() call takes no locale, so the date stays English after a language change.',
    // Only the functions that RENDER a date carry the locale. `parseISO`,
    // `startOfDay`, `addDays`, `isSameDay` and the rest are date arithmetic:
    // they return Dates and numbers, and having no locale is the point.
    detect: importsName(
      'date-fns',
      '(format|formatDistance|formatDistanceToNow|formatDistanceStrict|formatRelative|formatDuration|lightFormat)',
    ),
    owns: [/^src\/utils\//],
  },
  {
    id: 'local-search',
    canonical: 'useLocalSearch / filterByTerm (#hooks/search/useLocalSearch)',
    why: 'A hand-rolled filter re-decides case folding, trimming and which fields are searched, so two lists in one app match differently on the same term.',
    // A list SEARCH is a `.filter` over data. `toLowerCase().includes(...)` on
    // its own is string classification — an error message read for "timeout" —
    // and shares nothing with it but the call.
    detect: source =>
      /\.filter\(/.test(source) &&
      /toLowerCase\(\)[\s\S]{0,120}?\.includes\(/.test(source),
    owns: [
      /^src\/hooks\/search\//,
      /^src\/hooks\/ui\/useAutocompleteSearch\.ts$/,
      // Ingredient-to-pantry matching, which contains BOTH ways on purpose so
      // "tomato" matches "cherry tomatoes" and "olive oil" matches "oil". No
      // term is typed, so there is no search behaviour to make consistent.
      /^src\/services\/spoonacular\/utils\.ts$/,
    ],
  },
  {
    id: 'loading-indicator',
    canonical:
      'Loading / LoadingBranded (#components/molecules/Loading), or a themed spinner from themedComponents',
    why: 'A raw ActivityIndicator takes the platform default colour, so it is the one spinner that does not follow the brand or the colour scheme.',
    detect: importsName('react-native', 'ActivityIndicator'),
    // The two files that OWN the mechanism: the molecule people reach for, and
    // the `withUnistyles` wrappers every themed spinner is built from.
    owns: [
      /^src\/components\/molecules\/Loading\.tsx$/,
      /^src\/components\/atoms\/themedComponents\.tsx$/,
    ],
  },
  {
    id: 'device-storage',
    canonical: 'a persisted slice of the Zustand store',
    why: 'A direct key-value read is invisible to the session-scoped reset, so it survives a sign-out.',
    // `zustandStorage` IS the canonical mechanism — it is the persist adapter a
    // slice hands to Zustand. The finding is the raw `storage` handle, which
    // reads and writes keys nothing enumerates.
    detect: importsName('#\\/?storage\\/mmkv', 'storage'),
    owns: [/^src\/storage\//, /^src\/store\//, /^src\/apollo\//],
  },
];

const violations = (rel, source) =>
  CONCERNS.filter(
    concern =>
      !concern.owns.some(re => re.test(rel)) &&
      (typeof concern.detect === 'function'
        ? concern.detect(source)
        : concern.detect.test(source)),
  ).map(concern => concern.id);

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      'src/features/x/List.tsx',
      'const r = items.filter(i => i.name.toLowerCase().includes(term));',
      ['local-search'],
    ],
    // String classification, not a list search: no `.filter` over data.
    [
      'src/apollo/offlineQueue/queueErrorPolicy.ts',
      "const retry = message.toLowerCase().includes('timeout');",
      [],
    ],
    [
      'src/features/x/Searched.tsx',
      "import { useLocalSearch } from '#hooks/search/useLocalSearch';",
      [],
    ],
    [
      'src/features/x/Spinner.tsx',
      "import { View, ActivityIndicator } from 'react-native';",
      ['loading-indicator'],
    ],
    [
      'src/components/molecules/Loading.tsx',
      "import { ActivityIndicator } from 'react-native';",
      [],
    ],
    [
      'src/features/x/Themed.tsx',
      "import { ThemedActivityIndicator } from '#components/atoms/themedComponents';",
      [],
    ],
    [
      'src/features/x/B.tsx',
      "import { format } from 'date-fns';",
      ['date-formatting'],
    ],
    ['src/utils/dateUtils.ts', "import { format } from 'date-fns';", []],
    [
      'src/features/x/List.tsx',
      "import { FlatList } from 'react-native';",
      ['list-primitive'],
    ],
    // A pager is a different primitive, not an un-migrated list.
    [
      'src/features/x/Carousel.tsx',
      "import { FlatList } from 'react-native';\nconst a = <FlatList horizontal pagingEnabled />;",
      [],
    ],
    [
      'src/features/x/Photo.tsx',
      "import { Image } from 'react-native';\nconst a = <Image source={s} />;",
      ['image-component'],
    ],
    // Measuring a file draws nothing.
    [
      'src/features/x/Measure.ts',
      "import { Image } from 'react-native';\nImage.getSize(uri, cb);",
      [],
    ],
    // Animated.Image is the same RN component, reached without an import.
    [
      'src/features/x/Hero.tsx',
      "import Animated from 'react-native-reanimated';\nconst a = <Animated.Image source={s} />;",
      ['image-component'],
    ],
    [
      'src/features/x/Dialog.tsx',
      "import { Modal } from 'react-native';\nconst a = <Modal transparent visible={v} />;",
      ['modal-surface'],
    ],
    // Dims the screen itself, so nothing stays lit under it.
    [
      'src/features/x/DimmedDialog.tsx',
      "import { Modal } from 'react-native';\nconst a = <Modal transparent visible={v} />;\nconst s = { bg: theme.colors.overlays.medium };",
      [],
    ],
    [
      'src/features/x/FullScreen.tsx',
      "import { Modal } from 'react-native';\nconst a = <Modal transparent={false} visible={v} />;",
      [],
    ],
    // Date ARITHMETIC has no locale to lose.
    [
      'src/features/x/B2.tsx',
      "import { parseISO, startOfDay, isSameDay } from 'date-fns';",
      [],
    ],
    [
      'src/features/x/B3.tsx',
      "import { formatDistanceToNow } from 'date-fns';",
      ['date-formatting'],
    ],
    // Reaching the instance for something other than translating is fine.
    ['src/store/index.ts', 'getI18n().changeLanguage(x)', []],
    [
      'src/features/x/D.tsx',
      "import { Text } from '#components/atoms/Text';",
      [],
    ],
    // The persist adapter IS the canonical mechanism; the raw handle is not.
    [
      'src/features/x/store.ts',
      "import { zustandStorage } from '#/storage/mmkv';",
      [],
    ],
    [
      'src/features/x/E2.ts',
      "import { storage } from '#/storage/mmkv';",
      ['device-storage'],
    ],
  ];
  let failed = false;
  for (const [rel, source, expected] of cases) {
    const got = violations(rel, source);
    if (got.sort().join(',') !== [...expected].sort().join(',')) {
      console.error(
        `✗ Self-test failed for ${rel}: expected [${expected}], got [${got}].`,
      );
      failed = true;
    }
  }
  const ids = new Set(CONCERNS.map(c => c.id));
  if (ids.size !== CONCERNS.length) {
    console.error('✗ Self-test failed: a concern id is duplicated.');
    failed = true;
  }
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: ${CONCERNS.length} concerns detect their alternative,\n` +
      '  and the module that IS the canonical mechanism is not a finding.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const files = filesUnder(SCAN_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: files.length,
  what: 'source files',
  check: 'check-canonical-mechanisms',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 200,
});

/** `<concern>::<file>` — one entry per pair, so a file can shrink one at a time. */
const findings = [];
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  for (const id of violations(rel, readFileSync(file, 'utf8'))) {
    findings.push(`${id}::${rel}`);
  }
}

const current = [...findings].sort();

if (flags.list) {
  for (const concern of CONCERNS) {
    const hits = current
      .filter(f => f.startsWith(`${concern.id}::`))
      .map(f => f.split('::')[1]);
    console.log(`\n${concern.id} (${hits.length}) — use ${concern.canonical}`);
    console.log(`    ${concern.why}`);
    for (const rel of hits) console.log(`      ${rel}`);
  }
  console.log(
    `\n${current.length} file/concern pair(s) across ${files.length} files.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().pairs ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-canonical-mechanisms',
  });
  const byConcern = Object.fromEntries(
    CONCERNS.map(c => [
      c.id,
      current.filter(f => f.startsWith(`${c.id}::`)).length,
    ]),
  );
  BASELINE.write({
    pairs: current,
    countsByConcern: byConcern,
    scannedFiles: files.length,
  });
  console.log(
    `Recorded ${current.length} pair(s): ` +
      Object.entries(byConcern)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${id} ${n}`)
        .join(', '),
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-canonical-mechanisms');
const { added, removed } = diffSets(current, baseline.pairs ?? []);

if (added.length) {
  console.error(
    `\n✗ check-canonical-mechanisms: ${added.length} new use(s) of a non-canonical mechanism.\n`,
  );
  for (const pair of added) {
    const [id, rel] = pair.split('::');
    const concern = CONCERNS.find(c => c.id === id);
    console.error(`    ${id.padEnd(20)} ${rel}`);
    console.error(`    ${''.padEnd(20)} use ${concern.canonical}`);
  }
  console.error(
    `\n  Each of these has one canonical mechanism, and the alternative loses\n` +
      `  what it already solves. See CLAUDE.md and docs/development.md.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-canonical-mechanisms: ${removed.length} baselined use(s) are gone.\n`,
  );
  for (const pair of removed) console.error(`    ${pair.replace('::', '  ')}`);
  console.error(
    `\n  Record it: node scripts/check-canonical-mechanisms.mjs --update\n` +
      `  When a concern reaches zero, delete it here and add the ban to\n` +
      `  RESTRICTED_IMPORT_PATHS in .eslintrc.js instead.\n`,
  );
  process.exit(1);
}

console.log(
  `check-canonical-mechanisms: ${current.length} non-canonical use(s) across ` +
    `${CONCERNS.length} concerns, baseline ${baseline.pairs?.length ?? 0}.`,
);
