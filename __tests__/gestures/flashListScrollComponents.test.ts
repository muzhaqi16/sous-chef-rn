import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Every FlashList declares which scroll component it renders through.
 *
 * RNGH answers a native view grabbing the touch stream with
 * `cancelAllLegacyHandlers()`, which — per its own docblock — "Cancels all handlers
 * created using API v1 and v2". `ReanimatedSwipeable` and RNGH's `Pressable` are on
 * the v3 detectors, so over a plain RN ScrollView their handlers survive the
 * takeover: a row's pan keeps accumulating horizontal travel until it opens
 * mid-scroll, and a press fires on a finger that only stopped a fling
 * (RNGH #4432 / #4441). Confirmed here by A/B on device — removing the prop from one
 * list reproduced it immediately, restoring it cleared it.
 *
 * The fix is to give the list a scrollable RNGH can arbitrate against, so
 * `makeActive` cancels the row's handler. Two are legitimate:
 *
 *   - `SwipeAwareScrollComponent` — RNGH's ScrollView, for screen-level lists.
 *   - `BottomSheetScrollable`     — gorhom's, for lists inside a bottom sheet,
 *                                   which own the slot and must keep it.
 *
 * This guard exists because the failure is SILENT: the prop is simply absent and
 * nothing throws. That is exactly how the repo lost `dragOffsetFromLeftEdge` when
 * RNGH renamed it in 3.x.
 *
 * What it catches: a NEW list shipping without a decision.
 * What it does NOT catch: an allowlisted list later gaining a gesture-bearing row
 * (dropping a `QuantityBadge` into a recipe card, say). The row→list relation runs
 * through context providers and `renderItem` factories, so no static check follows
 * it; the CLAUDE.md rule covers that case by convention.
 */

/** Lists that legitimately render through RN's own ScrollView. */
const NO_RNGH_GESTURES_IN_ROWS: Record<string, string> = {
  'src/features/recipes/screens/MyRecipes.tsx':
    'recipe cards use RN Pressable only — no RNGH gesture in the row',
  'src/features/recipes/screens/SavedRecipes.tsx':
    'recipe cards use RN Pressable only — no RNGH gesture in the row',
  'src/features/shoppingList/screens/PurchaseHistoryScreen.tsx':
    'purchase rows are inert — no RNGH gesture in the row',
};

/** Screen-level lists whose rows carry RNGH gestures; RNGH's scroll is required. */
const RNGH_GESTURE_ROWS = [
  'src/features/pantry/components/PantryContent.tsx',
  'src/features/pantry/screens/FilteredPantryItems.tsx',
  'src/components/organisms/ItemList.tsx',
  'src/features/shoppingList/components/SortableShoppingList/SortableList.tsx',
];

const SRC = join(process.cwd(), 'src');

/**
 * Strip comments before looking for `<FlashList`, so a docblock example does not
 * read as a render — `ItemListActionsContext.tsx` documents usage that way.
 */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');

const collectTsxFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') collectTsxFiles(full, found);
    } else if (entry.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
};

const flashListRenderers = collectTsxFiles(SRC)
  .filter(file =>
    stripComments(readFileSync(file, 'utf8')).includes('<FlashList'),
  )
  .map(file => relative(process.cwd(), file))
  .sort();

describe('FlashList scroll components', () => {
  it('finds the lists at all, so the checks below are not vacuous', () => {
    expect(flashListRenderers.length).toBeGreaterThan(10);
    expect(flashListRenderers).toEqual(
      expect.arrayContaining(RNGH_GESTURE_ROWS),
    );
  });

  it('does not mistake a documented example for a rendered list', () => {
    expect(flashListRenderers).not.toContain(
      'src/components/organisms/ItemListActionsContext.tsx',
    );
  });

  it.each(RNGH_GESTURE_ROWS)('%s renders through RNGH', file => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');

    expect(source).toContain(
      'renderScrollComponent={SwipeAwareScrollComponent}',
    );
    // Via the shared module, which is where the mechanism is written down and the
    // one place to revisit if RNGH closes the gap upstream.
    expect(source).toContain(
      "from '#components/atoms/SwipeAwareScrollComponent'",
    );
  });

  it('leaves no list undeclared', () => {
    const undeclared = flashListRenderers.filter(file => {
      if (file in NO_RNGH_GESTURES_IN_ROWS) return false;
      return !readFileSync(join(process.cwd(), file), 'utf8').includes(
        'renderScrollComponent={',
      );
    });

    expect(undeclared).toEqual([]);
  });

  it('keeps the allowlist honest', () => {
    for (const [file, reason] of Object.entries(NO_RNGH_GESTURES_IN_ROWS)) {
      // Still a list — otherwise the entry is dead and should go.
      expect(flashListRenderers).toContain(file);
      expect(reason.length).toBeGreaterThan(0);

      // And still opting out. One that started declaring a scroll component no
      // longer needs an exemption.
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('renderScrollComponent={');
    }
  });
});
