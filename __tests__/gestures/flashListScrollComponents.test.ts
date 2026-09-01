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
  'src/features/pantry/screens/PantryUsageHistoryScreen.tsx':
    'usage rows are inert — no RNGH gesture in the row',
  'src/features/pantry/screens/PantryBatchHistoryScreen.tsx':
    'batch rows act through AppPressable, which is RN Pressable — no RNGH gesture in the row',
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

/**
 * Files rendering a scrollable inside gorhom's `BottomSheetView`.
 *
 * `BottomSheetView`'s own style is `{ position: 'absolute', left: 0, top: 0,
 * right: 0 }` — no bottom, no height — and gorhom composes it AFTER the
 * caller's, so a caller's `flex: 1` loses. A list inside it is never
 * height-bounded and cannot scroll; `handleSettingScrollable` also registers
 * SCROLLABLE_TYPE.VIEW after the list registers itself, so the sheet loses
 * scrollable arbitration too. `maxHeight` lists merely get away with it.
 *
 * The repo has already paid for this once (`BottomSheetAutocompleteInput`
 * records the observed failure), and PR #216 moved a third instance across the
 * tree without noticing. Detection is deliberately crude — the opening tag and
 * a scrollable somewhere after it in the same file — because a false positive
 * costs a `View` swap and a false negative costs a sheet nobody can scroll.
 */
const SCROLLABLES = [
  '<FlashList',
  '<BottomSheetScrollView',
  '<BottomSheetFlatList',
  '<BottomSheetFormScrollView',
  '<BottomSheetScrollable',
];

/** Files the scan above reads as a nest, with the reason each one is not. */
const BOUNDED_ANOTHER_WAY: Record<string, string> = {
  'src/components/atoms/BottomSheetLayout.tsx':
    'the two are ALTERNATIVES, not a nest — this component picks BottomSheetView for its `view` variant and a scroll view for its `form` variant',
  'src/components/molecules/FolderPicker.tsx':
    'the list carries an explicit maxHeight, so it is bounded without the container — the variant CLAUDE.md records as getting away with it',
  'src/components/molecules/TagPicker.tsx':
    'the list carries an explicit maxHeight, so it is bounded without the container',
};

const bottomSheetViewWrappers = collectTsxFiles(SRC)
  .filter(file => {
    const source = stripComments(readFileSync(file, 'utf8'));
    const opensView = source.indexOf('<BottomSheetView');
    if (opensView === -1) return false;
    return SCROLLABLES.some(tag => source.indexOf(tag, opensView) !== -1);
  })
  .map(file => relative(process.cwd(), file))
  .filter(file => !(file in BOUNDED_ANOTHER_WAY))
  .sort();

describe('scrollables inside BottomSheetView', () => {
  it('finds the sheets at all, so the check below is not vacuous', () => {
    // Guard on the guard: the scan must still be able to SEE a BottomSheetView.
    const anySheetViews = collectTsxFiles(SRC).filter(file =>
      stripComments(readFileSync(file, 'utf8')).includes('<BottomSheetView'),
    );
    expect(anySheetViews.length).toBeGreaterThan(0);
  });

  it('never nests one, because it cannot be height-bounded', () => {
    expect(bottomSheetViewWrappers).toEqual([]);
  });

  it('keeps the allowlist honest', () => {
    // An entry whose file stopped matching is a stale exemption that will
    // silently cover the next file to take its path.
    const matched = collectTsxFiles(SRC)
      .filter(file => {
        const source = stripComments(readFileSync(file, 'utf8'));
        const opensView = source.indexOf('<BottomSheetView');
        if (opensView === -1) return false;
        return SCROLLABLES.some(tag => source.indexOf(tag, opensView) !== -1);
      })
      .map(file => relative(process.cwd(), file));

    const stale = Object.keys(BOUNDED_ANOTHER_WAY).filter(
      file => !matched.includes(file),
    );

    expect(stale).toEqual([]);
  });
});

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

  /**
   * The scrollable is only half the arbitration.
   *
   * RNGH's ScrollView hands its scroll gesture to the refresh control as
   * `cloneElement(refreshControl, { block: scrollGesture })`, and `block` is in
   * `NativeWrapperProps` — so only a control built by RNGH's `createNativeWrapper`
   * routes it into `useNativeGesture`. Handed RN's plain RefreshControl the prop is
   * simply inert: no error, no warning, no arbitration on the pull.
   *
   * The trap is that you can get RN's control WITHOUT ever naming it. Given a bare
   * `onRefresh`/`refreshing` pair and no `refreshControl`, FlashList builds one
   * itself — `useSecondaryProps.tsx`, `else if (onRefresh)` — and the one it builds
   * is React Native's. That is how the shopping list shipped with an indicator that
   * hung mid-list and would not retract until pushed back up by hand, while every
   * list that passed an explicit control was fine.
   *
   * So the rule is about the HOST, and this derives its file list from the tree
   * rather than a constant: any list rendering RNGH's scrollable that offers
   * pull-to-refresh must pass an explicit RNGH-based control.
   */
  const rnghHostedLists = flashListRenderers.filter(file =>
    stripComments(readFileSync(join(process.cwd(), file), 'utf8')).includes(
      'renderScrollComponent={SwipeAwareScrollComponent}',
    ),
  );

  it('finds the RNGH-hosted lists, so the check below is not vacuous', () => {
    expect(rnghHostedLists).toEqual(expect.arrayContaining(RNGH_GESTURE_ROWS));
  });

  it.each(RNGH_GESTURE_ROWS)(
    '%s is covered by the RNGH-host refresh rule',
    file => {
      expect(rnghHostedLists).toContain(file);
    },
  );

  it('gives every RNGH-hosted list with pull-to-refresh an RNGH control', () => {
    const offenders = rnghHostedLists.filter(file => {
      const source = stripComments(
        readFileSync(join(process.cwd(), file), 'utf8'),
      );
      if (!source.includes('onRefresh=')) return false; // no pull-to-refresh

      // An explicit control is required — a bare onRefresh gets RN's.
      if (!source.includes('refreshControl=')) return true;
      // And it has to be the RNGH-based one.
      if (!source.includes('ThemedRefreshControl')) return true;
      // RN's control must not be reachable by name either.
      return /import\s*\{[^}]*\bRefreshControl\b[^}]*\}\s*from\s*'react-native'/.test(
        source,
      );
    });

    expect(offenders).toEqual([]);
  });

  /**
   * The pairing is not merely a quality issue in one direction — it is a CRASH.
   *
   * `ThemedRefreshControl` wraps RNGH's control, which renders a `VirtualDetector`,
   * and that component's first statement is `useRequiredInterceptingDetectorContext()`
   * — it THROWS `"VirtualGestureDetector must be a descendant of an
   * InterceptingGestureDetector"` when no RNGH scrollable is above it. So an RNGH
   * control in a plain RN `ScrollView` does not merely lose arbitration, it takes
   * the screen down. `PlainScrollRefreshControl` exists for those hosts.
   *
   * An RNGH host is either a FlashList rendering RNGH's scroll component, or RNGH's
   * `ScrollView` used directly — both provide the context, and the second is why a
   * check written only against `renderScrollComponent` reads false positives.
   */
  const usesRnghRefreshControl = collectTsxFiles(SRC)
    .map(file => relative(process.cwd(), file))
    .filter(file => file !== 'src/components/atoms/themedComponents.tsx')
    .filter(file =>
      stripComments(readFileSync(join(process.cwd(), file), 'utf8')).includes(
        '<ThemedRefreshControl',
      ),
    )
    .sort();

  it('finds the RNGH refresh-control call sites, so the check below is not vacuous', () => {
    expect(usesRnghRefreshControl.length).toBeGreaterThan(3);
  });

  it('never puts an RNGH refresh control in a plain RN scrollable', () => {
    const wouldThrow = usesRnghRefreshControl.filter(file => {
      const source = stripComments(
        readFileSync(join(process.cwd(), file), 'utf8'),
      );
      const flashListHost = source.includes(
        'renderScrollComponent={SwipeAwareScrollComponent}',
      );
      const rnghScrollViewHost =
        /import\s*\{[^}]*\bScrollView\b[^}]*\}\s*from\s*'react-native-gesture-handler'/.test(
          source,
        );
      return !flashListHost && !rnghScrollViewHost;
    });

    expect(wouldThrow).toEqual([]);
  });

  /**
   * `ThemedRefreshControl` is the single place the RNGH-vs-RN choice is made for
   * every list above, so the per-file checks cannot see it. This is that check.
   * `PlainScrollRefreshControl` is its counterpart for plain RN scrollable hosts.
   */
  it('builds ThemedRefreshControl on RNGH, not RN', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/atoms/themedComponents.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /import\s*\{[^}]*\bRefreshControl\b[^}]*\}\s*from\s*'react-native-gesture-handler'/,
    );
    expect(source).toContain('PlainScrollRefreshControl');
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
