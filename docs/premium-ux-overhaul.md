# Premium UX Overhaul — Progress Tracker

> Goal: raise the app from "functionally good, visually inconsistent" to a **premium, smooth,
> consistent** feel. Driven by a multi-agent audit (design tokens, motion, loading UX,
> micro-interactions) + 2025–2026 best-practice research.

## Working rules (agreed with owner)

1. **Validate before** starting each phase (confirm findings against current code + APIs).
2. **Validate after** completing each phase.
3. **Stay in scope** — anything new discovered mid-phase is deferred to a *future* phase, not done now.
4. After **every phase**: `npm run codegen`, `npm run typecheck`, `npm run lint` must pass.
5. Keep this document updated as the single source of truth for progress.

## Core diagnosis

The **foundation is already premium-grade** (centralized motion tokens in
`src/constants/animations.ts`, centralized skeletons, `HapticService`, toast queue, themed
component layer, semantic theme + dark mode, a `Text` variant system). The app feels cheap
because these systems are **applied inconsistently** — the gap between polished primitives and
un-instrumented everyday moments (a tab tap, a list-cell press, a skeleton swap, a silent
success toast) is what reads as "not premium." This is **hardening, not a rewrite.**

---

## Phase status

| Phase | Title | Status |
|---|---|---|
| 1 | Kill the flicker & dead cuts | ✅ Done |
| 2 | Tactile feedback everywhere (haptics + press states) | ✅ Done |
| 3 | Token hardening — typography + card elevation | ✅ Done (re-scoped) |
| 4 | Refinement — image fade-in + RecipeDetail error state | ✅ Done (re-scoped) |
| 5 | List motion (reflow/layout) — **device-tested → reverted** | ⏸️ Blocked (needs data-pipeline rework) |
| 6 | Scrim / alpha-color token migration (`withAlpha` + named scrims, ~40 files) | ⬜ Not started (deferred from P3) |
| 7 | **Enforcement — ESLint import bans** (`Text`/`Pressable`/`Touchable` → atoms/re-exports) + `any`-warning root-cause fix | ✅ Done (56 files migrated; lint 0 warnings) |
| 7b | Token enforcement tail — spacing-scale purification + raw-hex→token guards | ⬜ Not started (not cleanly lint-enforceable — see notes) |
| 8 | **Consistency: `AppPressable` + `PressableScale` + `SegmentedControl` reuse + `SettingRow` dedup** | ✅ Done (all device-verified) |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⏸️ Blocked

### Consistency tracks (validated by pre-refactor agents, 2026-06-02)
Three approaches were agent-validated **before** any change (per owner directive). All came back
**GO-with-mitigation**:
- **T8a — `AppPressable` canonical pressable** (this phase): `opacity: theme.opacity.pressed` (0.7)
  is already hand-rolled in **145/151** files. Haptic (5/151) and ripple (9 total) are opt-in. Safe
  API wraps RN `Pressable`, appends `pressed` via the array pattern (composes with `useVariants`).
  Excludes the 13 scale sites (→ future `PressableScale`) and 6 RNGH gesture-composition sites.
- **T8b — AppearanceScreen → shared `SegmentedControl`**: ✅ Done (device-verified). Added 2-line label
  support to the shared `SegmentedTab` first (the `numberOfLines={1}` truncation regression for the
  4-segment Font-scale row in SQ/ES/IT/EN), then migrated all 3 inline controls to the shared one.
- **T8c — `SettingRow` consolidation**: ✅ Done. Deleted dead `components/settings/SettingRow.tsx`;
  canonical `molecules/SettingRow` now renders `item.subtitle` + a gated selection haptic.
- **Correction logged:** the earlier filter-tab "regression" was most likely the `android_ripple` +
  `overflow:'hidden'` I added (and/or an RNGH-Pressable path), **not** function-style + `useVariants`
  — that combo works on RN `Pressable` (live in `Counter`, `SegmentedControl`, `ExpirationActionSheet`).

#### T8a execution — full sweep via deterministic codemod
- Wrote `scripts/codemods/pressable-to-app-pressable.js` (jscodeshift). Conservative: transforms ONLY
  `<Pressable style={({ pressed }) => [A, …, pressed && _.pressed]}>` → `<AppPressable style={[A, …]}>`;
  skips files importing RNGH `Pressable`; skips any non-canonical shape. Ran via `npx` (no dep added).
- Result: **119 files migrated, 0 errors, 555 conservatively skipped.** Manual settings adoption
  (AppearanceScreen swatches, NotificationSettings picker rows) + the `AppPressable` atom remain.
- **Edge case found by the test suite (agents missed it):** `StorageLocationForm` uses a *dynamic
  inline* style (`{ backgroundColor: preset.value }`) inside the pressable. After migration, the
  Unistyles babel plugin processes `<AppPressable>`'s style via the generic component path and injects
  a **Reanimated dev-helper call** (`getUseOfValueInStyleWarning`) that a bare `<Pressable>` (core
  component, special ShadowTree path) did not. The project's custom Reanimated **test mock** lacked
  that export → 14 tests in 1 suite threw `not a function`. The **real app is unaffected** (Reanimated
  exports it; it's a no-op SharedValue-misuse check). Fix: added `getUseOfValueInStyleWarning` to
  `__tests__/setup/mocks/react-native-reanimated.js`.
- **Open question being device-verified:** the generic-path processing means `AppPressable` styles may
  re-render on theme change rather than ShadowTree-update (a minor perf delta, NOT a correctness bug,
  since `AppPressable` wraps RN `Pressable` — the blessed array-merge pattern). Verifying theme/color
  switching still updates migrated screens on device before declaring the sweep done.
- Validation so far: typecheck ✅ · lint ✅ (0 errors) · **full suite 5972/5972 ✅**.
- **Device-verified ✅:** theme/app-color switching updates migrated screens correctly (reactivity
  intact) and press feedback is unchanged. Confirms the RN-`Pressable` wrapper keeps Unistyles
  reactivity. Committed by owner as `92a81e9d "feat: standarize pressable"`.
- Dead-style cleanup: ran a second conservative codemod — only **1** file (`ExpirationActionSheet`,
  which also normalized its divergent `opacity: 0.6` → standard `0.7`). The rest of the local
  `pressed` styles are NOT dead (still used by non-migrated variant/gesture pressables in the same
  files), so no churn. One-time codemod scripts removed afterward (they tripped the RN
  `no-restricted-syntax` `.value` rule and were single-use).
- **Final validation:** typecheck ✅ · lint ✅ (0 errors) · full suite **5972/5972** ✅ · device ✅.

#### T8a-scale — `PressableScale` (scale press feedback) ✅
**Agent validation refuted the premise:** there are **not 13 scale-press sites — only 2** (`Button`
the reference, `AddButton` the one clean target). The other ~11 `withSpring`+`scale` hits are *non-press*
animations (parallax, sliding indicators, value bounces, swipe-progress, pinch) and were correctly
**excluded** — forcing them onto a press-scale atom would regress (combined worklets, recycling resets,
RNGH gesture coordination). No card uses scale (the FlashList-leak worry was theoretical).
- Built `src/components/atoms/PressableScale.tsx` (+ test): `Animated.createAnimatedComponent(RN Pressable)`,
  spring scale on `onPressIn/Out` (JS-thread — no `scheduleOnRN`/worklet boundary), `activeScale` +
  opt-in `haptic`; compiler-clean; theme-reactive (same shape `Button` already shipped).
- Migrated `AddButton` (`activeScale={0.9}`, `haptic="medium"`) and **dogfooded `Button`**
  (`activeScale={0.97}`, `haptic="light"`) onto it → single source of truth for scale-press mechanics.
  Per-site scale values preserved (depth is element-size-dependent, unlike the opacity 0.7 normalization).
- Validation: typecheck ✅ · lint ✅ (0 errors) · full suite **5976/5976** ✅ · **device-verified ✅**
  (Button scale+light haptic, + FAB scale 0.9+medium haptic + App-Color reactivity — owner confirmed).

**Pressable centralization COMPLETE & device-verified:** `AppPressable` (opacity, 119 sites) +
`PressableScale` (scale, Button + AddButton + future). RNGH gesture-composition sites stay on RNGH
`Pressable` by design. One consistent touch model app-wide.

#### T8b — AppearanceScreen → shared `SegmentedControl` ✅
- Added 2-line label support to the shared `SegmentedTab` (`numberOfLines={2}` + `textAlign:'center'`)
  — fixes the truncation regression for the 4-segment Font-scale row in SQ/ES/IT/EN.
- Migrated AppearanceScreen's 3 inline segmented controls (theme/density/font) to the shared
  component (premium sliding spring indicator + selection haptic); deleted the inline copy + `segStyles`.
- Validation: my files typecheck-clean · lint 0 errors · full suite **5983/5983** ✅ · **device-verified ✅**.

#### T8c — `SettingRow` dedup ✅
- Deleted dead `components/settings/SettingRow.tsx` (zero prod consumers) + its test `describe` block.
- Canonical `molecules/SettingRow`: now renders `item.subtitle` (fixes the latent biometric-subtitle
  dead data) and fires a gated `selection()` haptic (skips `info`/`switch`/`disabled`).
- Validation: typecheck-clean · lint 0 errors · full suite ✅ · **device-verified ✅**.

> ⚠️ **Repo typecheck is currently RED from unrelated parallel work** — `useDeepLinkRouter.test.ts:227`
> (a `Partial<RootState>` cast that broke when `navigationSlice` added `pendingDeepLinkAction`). NOT
> from the consistency work; flagged to owner. The suggested `as unknown` fix violates the no-`as
> unknown as` rule — needs proper mock typing.

**Premium-consistency pass essentially complete:** Phases 1–4 + full pressable centralization
(`AppPressable` + `PressableScale`) + `SegmentedControl` reuse + `SettingRow` dedup.

---

## Phase 1 — Kill the flicker & dead cuts

**Objective:** eliminate the two highest-felt problems — skeletons flashing over already-cached
content, and hard-cut transitions on the screens users look at most.

### Validation (before) — findings confirmed against current code
- `HomeTabs.tsx:48` — tabs use `animation: 'none'` (hard cut). `'fade'` is a valid
  `TabAnimationName` in `@react-navigation/bottom-tabs@8`. ✅
- `RecipeDetail/index.tsx:227` — `if (loading)` wipes a cached recipe to a full-screen loader on
  every `cache-and-network` refetch. `displayData` is in scope. ✅
- `RecipeMain.tsx:461` — skeleton condition lacks an `items.length === 0` guard, so a populated
  list is replaced by a skeleton on refetch. ✅
- `DeferredScreen.tsx` — wraps **all four** primary tab screens (Pantry/Shopping/Recipe/MealPlan)
  and hard-swaps fallback→component. Tests mock the module, so a render change is safe. ✅
- `ShoppingTab.tsx:82-130` — reference crossfade pattern (always-mounted content + absolute
  skeleton overlay with `exiting={FadeOut}`). To be replicated. ✅

### Scope (in)
- [x] **1.1** `RecipeDetail`: gate full-screen loader on `loading && !displayData`.
      (`src/features/recipes/screens/RecipeDetail/index.tsx:227`)
- [x] **1.2** `RecipeMain`: add `&& screen.items.length === 0` to the skeleton condition.
      (`src/features/recipes/screens/RecipeMain.tsx:461`)
- [x] **1.3** `HomeTabs`: `animation: 'fade'` on the bottom-tab navigator.
      (`src/navigation/stacks/HomeTabs.tsx:48`)
- [x] **1.4** `DeferredScreen`: crossfade skeleton→content (ShoppingTab overlay pattern) — lifts
      the initial-mount transition of all four tab screens.
      (`src/components/performance/DeferredScreen.tsx`)
- [~] **1.5** `ProfileScreen` entry fade — **dropped from P1.** ProfileScreen already has the
      correct `loading && !profile` guard and is a *pushed* screen; layering an `entering` fade
      on top of the native-stack slide risks a double-animation on the common cached path. Better
      done later with a "fade only when a skeleton was actually shown" guard → revisit in Phase 4/5.

### Discovered → DEFERRED to Phase 5 (out of scope for P1)
- The audit recommended `itemLayoutAnimation={...}` on the Pantry/Shopping FlashLists.
  **FlashList v2 (2.3.1) has no `itemLayoutAnimation` prop** — that API is FlatList/reanimated.
  v2 does layout animation via a `layout` prop on the `CellRendererComponent`, which **fires on
  scroll-recycle** (jank risk) and must be verified on a device. Likewise, per-cell
  `entering={FadeIn}` on the shared `AnimatedCellRenderer` would fire on every recycle during
  scroll. Both moved to **Phase 5** for device-tested implementation.
- Full skeleton-overlay restructure of `PantryContent` (its skeleton renders *inside* the
  FlashList via a sentinel + footer, not as a separable layer) and `RecipeMain`'s internal
  discovery-refetch ternary → **Phase 5** (after the list-motion pattern is proven on device).

### Validation (after) — all green
- [x] `npm run codegen` passes
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] Affected tests pass — 70/70 across `RecipeMain`, `MealPlanMain`, `ShoppingListMain`,
      `PantryMain`, `RecipeDetailScreen` (DeferredScreen is mocked in screen tests, so the
      crossfade rewrite is contract-compatible).
- [ ] Device/simulator visual confirmation (recommended before sign-off — owner to run the app).

---

## Future phases (summary — detail added when each starts)

### Phase 2 — Tactile feedback everywhere ✅ (detail in change log)
### Phase 3 — Token hardening: typography + card elevation ✅ (detail in change log)

### Phase 4 — Refinement
- Image fade-in via `react-native-turbo-image` `fadeDuration` (currently `0`) + soft shimmer-out.
- Replace `RecipeDetail` raw-JSON error dump with the shared `EmptyState`.
- Remove dead motion code (`staggeredEntryAnimation`/`screenEntryAnimation` if unused, inert
  `sharedTransitionTag`).
- (Possibly defer) `TextInputModal`/`NumberInputModal` off RN `Modal` to `useStandardBottomSheet`
  — behavior-changing refactor, better device-verified; `PressableRow` settings rows (from P2);
  `ProfileScreen` fade (from P1).

### Phase 5 — List motion (device-verified)
- `layout` reflow animation on Pantry/Shopping FlashList cells (via `CellRendererComponent`),
  guarded against scroll-recycle jank; verify on simulator/device.
- Skeleton-overlay crossfade for `PantryContent` + `RecipeMain` internal ternary.

### Phase 6 — Scrim / alpha-color token migration
- Add `withAlpha()` helper + named scrim tokens; migrate ~40 files off `${color}NN` / raw
  `rgba(0,0,0,x)`. Pure hygiene, no visible change.

### Phase 7 — Token enforcement (depends on P6)
- Purify spacing scale (drop `'2.5'/'3'/'5'` numeric keys); migrate 12 raw-RN-`Text` files to the
  atom; then add ESLint guards (raw hex, raw numeric spacing/fontSize, RN `Text`). Can only land
  once the violations above are cleaned, else `npm run lint` fails.

---

## Change log

### Phase 1 — Kill the flicker & dead cuts ✅
- `RecipeDetail/index.tsx` — full-screen loader now gated on `loading && !displayData`; a
  `cache-and-network` refetch no longer wipes the rendered recipe back to a loader.
- `RecipeMain.tsx` — skeleton condition gained `&& screen.items.length === 0`; a populated
  discovery/search list is never replaced by a skeleton on background refetch.
- `HomeTabs.tsx` — bottom-tab `animation: 'none'` → `'fade'`. Every tab switch now crossfades.
- `DeferredScreen.tsx` — rewritten to the ShoppingTab overlay pattern: real component mounts
  underneath; the skeleton leaves via `exiting={FadeOut.duration(TIMING.STANDARD)}`. Softens the
  initial-mount skeleton→content swap for **all four** primary tab screens at once. Deferral
  semantics unchanged (component still gated behind `isReady`).
- Validation: codegen ✅ · typecheck ✅ · lint ✅ · 70 tests ✅.
- Deferred to Phase 5: FlashList list-reflow/layout + per-cell entering (FlashList v2 has no
  `itemLayoutAnimation` prop; correct `layout`-on-CellRenderer approach has scroll-recycle risk
  and needs device verification), plus the PantryContent / RecipeMain-internal skeleton-overlay
  restructure.

### Phase 2 — Tactile feedback everywhere ✅

**Validation (before):** confirmed `react-native-haptic-feedback` is globally mocked
(`jest.setup.js:35`), `theme.opacity.pressed = 0.7`, and `RIPPLE.SUBTLE` exists for card/row
surfaces. Both filter-tab components already fired `HapticService.selection()` but had no visual
press state; `BaseItemCard`'s `onPress` branch and `BaseInput`'s error reveal had none.

Changes:
- `toastService.ts` — `success`/`error`/`warning` now fire the matching notification haptic
  (`HapticService.success/error/warning`); `info` stays silent. One edit wires correct haptics
  into **all** toast consumers (the ~20 mutation hooks that previously fired success/error toasts
  silently).
- `BaseItemCard.tsx` — the `onPress`-only branch (the app's most common list-cell tap, previously
  zero feedback) now has `pressed` opacity (`theme.opacity.pressed`), `android_ripple={RIPPLE.SUBTLE}`,
  and a `selection()` haptic. Matches the `IconButton` pattern.
- `FilterTabItem.tsx` (shopping) + `FilterTabsItem.tsx` (shared) — added a visual `pressed` state
  (function-style `style` callback) + `android_ripple={RIPPLE.SUBTLE}` + `overflow: 'hidden'` so the
  ripple respects the rounded corners. (Both already fired the selection haptic.)
- `BaseInput.tsx` — error message now reveals via Reanimated `entering={FadeIn}` /
  `exiting={FadeOut}` (`TIMING.FAST`) instead of a mount/unmount hard cut.

**Validation (after):** codegen ✅ · typecheck ✅ · lint ✅ · tests ✅ — 28 direct
(`toastService`, `FilterTabs`, `BaseItemCard` slots) + 79 downstream consumers (`PantryItemCard`,
`FilterTabBar`, `Toast`, `SignUpScreen`, `AddEditItem`, `AddMealSheet`).

Deferred to a later phase (out of P2 scope): the `PressableRow` atom + settings-row press states
(`NotificationSettingsScreen`, `AppearanceScreen`) — a new shared atom + two-screen refactor,
better batched with Phase 4 refinement.

### Phase 3 — Token hardening: typography + card elevation ✅ (re-scoped)

**Validation (before):** confirmed `theme.typography.lineHeight` tokens (px), `letterSpacing.tight
= -0.5`, that `Text.tsx` set `lineHeight` on only the `title` variant and applied `letterSpacing`
nowhere, and that the two flagship cards (`HomeCard`, `ItemCard`) + `commonStyles.SHADOW` each
inlined the **same** card geometry (offsetY 4 / blur 15 / spread 1) with inconsistent color
encoding (`black + '1A'` vs `rgba(0,0,0,0.1)`). Confirmed the theme shadow tests iterate an
explicit `[sm,md,lg,xl]` array, so adding a `card` token is test-safe.

**Re-scope decision (discoveries deferred per working rule #3):** the original P3 also listed
scrim tokens, spacing-scale purification, and ESLint enforcement. Investigation showed:
- Scrims are **~40 files** of `${color}NN` / `rgba(0,0,0,x)` alpha usage — pure code hygiene with
  *no visible rendering change*. Not a premium-feel lever. → **Phase 6.**
- **ESLint enforcement guards cannot be added without breaking `npm run lint`** — strict
  no-raw-hex / no-numeric-spacing / no-RN-`Text` rules fail on the existing violations (incl. the
  `spacing['2.5'/'3'/'5']` numeric keys used across many files, and 12 files importing RN `Text`).
  They can only land *after* the corresponding cleanups. → **Phase 7** (depends on P6).

So P3 shipped the two **visible, bounded, premium** items:

Changes:
- `Text.tsx` — every variant now carries a default `lineHeight` (headings ~1.2–1.3×, body/label
  ~1.4–1.5×) and the display variants (`title`, `subtitle`) get `letterSpacing.tight`. Propagates
  to the 232 files that use `<Text>`. Proper leading/tracking is the single biggest type-level
  "premium" lift. Explicit `lineHeight`/`size` props still override (variant groups defined after).
- `foundations/shadows.ts` — added a `card` elevation token (the soft, wide, low-opacity float the
  cards were each inlining).
- `HomeCard.tsx`, `ItemCard.tsx`, `commonStyles.ts` — replaced the inlined `boxShadow` (and the
  module-level `SHADOW` const, used in 3 places) with `...theme.shadows.card`. One elevation
  language for resting cards; identical pixels, normalized color.

**Validation (after):** codegen ✅ · typecheck ✅ · lint ✅ (0 errors; 8 pre-existing
`no-explicit-any` warnings in untouched files, same as baseline) · 98 tests ✅ (`foundations`,
`themes`, `unistyles`, `ItemCard`, `HomeCard`, `ValueText`, `PantryItemCard`).

Not migrated in P3 (intentionally — distinct, non-card shadows): `FloatingTabBar`, `AddButton`
(primary-tinted), `ActionTray` (upward), `AlertProvider` (modal), tooltips/scan-line, subtle
panels (`ClickableInfoPanel`, `NutritionSummary`). A full elevation **taxonomy** (mapping these to
`md`/`xl`/a new `cardElevated`) is a separate device-reviewed pass — forcing them into `card` would
flatten intentional differences.

### Phase 4 — Refinement: image fade-in + RecipeDetail error state ✅ (re-scoped)

**Validation (before):** confirmed `CachedImage` uses `fadeDuration={0}` (hard pop-in) and keeps a
module-level `loadedUris` set; confirmed `EmptyState` API (`icon`/`title`/`description`/`action`)
and the `labels.goBack` + `errors.somethingWentWrong` translation keys. **Important discovery:**
the audit's "dead motion code" (`staggeredEntryAnimation`) is **not dead** — it's live in
`SortableItem` + `StaggeredEntryContext` (the `delayPerItem: 0` is deliberate config), so it was
**left untouched**. `screenEntryAnimation` (only referenced by a smoke test) and the inert
`sharedTransitionTag`s are harmless; removing them isn't a premium-feel win, so dead-code churn was
dropped from scope.

Changes:
- `CachedImage.tsx` — `fadeDuration={isPreloaded ? 0 : 200}`: a fresh image cross-fades in over
  200ms instead of popping; images already in `loadedUris` (scrolled back into view) stay instant,
  so lists don't flicker on recycle.
- `RecipeDetail/index.tsx` — the error state's raw `<Text>` + on-screen `JSON.stringify(backendError)`
  dump is replaced with a polished `EmptyState` (alert icon, localized message, **Go Back** action —
  the previous error screen had no way out). Removed the now-unused `errorText`/`errorDetails` styles.

**Validation (after):** codegen ✅ · typecheck ✅ · lint ✅ (0 errors; 8 pre-existing warnings) ·
59 tests ✅ (`CachedImage`, `RecipeDetailScreen`, `useRecipeDetail`).

Deferred (out of P4 scope): `TextInputModal`/`NumberInputModal` → `useStandardBottomSheet` (a
behavior-changing refactor — should be device-verified), the `PressableRow` settings-row atom (P2
carryover), and the `ProfileScreen` entry-fade (P1 carryover). These cluster into a future
"refinement 2 / device-verified" pass alongside Phase 5.

### Device verification of Phases 1–4 — regression found & fixed ⚠️→✅

Ran the app on a physical device (Samsung SM-S908U1). Found a **regression from the Phase 2
filter-tab press-feedback**, in two parts, both now fully reverted:

1. **Frozen active highlight (pantry filter tabs).** Pantry tabs drive their active background via
   Unistyles `styles.useVariants({ state: 'active' })`. Phase 2 changed the tab's `style` from an
   array to a function callback `({ pressed }) => [...]` to add a press opacity — and that froze the
   variant: the list filtered correctly but the highlight stuck on whichever tab it last painted.
   **Lesson:** a function-style `style` and `useVariants` driving the *same* style don't compose; the
   unit tests passed while visually broken, so only device verification caught it.
2. **Janky horizontal tab scrolling.** The `android_ripple` + `overflow: 'hidden'` added to each tab
   put a RippleDrawable + clip layer on every item inside the horizontal `ScrollView`, which the user
   felt as scroll jank.

**Fix:** fully reverted `FilterTabsItem.tsx` and `FilterTabItem.tsx` to their pre-Phase-2 state
(array `style`, no `android_ripple`, no `overflow`, no `pressed` style). Tabs keep the selection
haptic (which predates this work) and their active-state change as feedback. Net effect on Phase 2:
toasts, `BaseItemCard`, and input-error feedback stand; the **tab** press-feedback experiment is
withdrawn as not worth the variant/scroll cost.

Validation: typecheck ✅ · lint ✅ · FilterTabs/FilterTabBar tests ✅ · rebuilt on device for
re-verification. Note: `BaseItemCard` also uses `useVariants` + a function-style Pressable, but
there the variant is on the inner content `View` (array style) and the function-style is only on the
outer Pressable's `pressed` opacity — separate styles, so it is **not** affected by this issue.

**Follow-on (device-driven) improvement — smooth tab centering.** With the regression gone, the user
noted the active-tab auto-centering *jumped* instead of sliding. Root cause (pre-existing, in
`FilterTabs.tsx`, not part of my earlier changes): the recenter used
`scrollTo({ animated: false })`. Fixed by animating the recenter **only on tab change** — a
`hasAutoCenteredRef` gate keeps the first/mount positioning instant (no unwanted scroll when a screen
appears) and slides smoothly on every subsequent selection. typecheck ✅ · lint ✅ · tests ✅.

**Status: ✅ confirmed on device by the user** — highlight follows selection, centering slides
smoothly, manual horizontal scroll is smooth. Tab regression closed.

### Phase 5 — List reflow animation: attempted on device, reverted ⏸️

**Goal:** when a pantry item is deleted, slide the rows below up to fill the gap instead of snapping.

**What was tried (delete-only, pantry-scoped):** added an `AnimatedLayoutCellRenderer`
(`Animated.View` + `layout={LinearTransition(150ms)}`) used **only** on the pantry FlashList — kept
the shared `AnimatedCellRenderer` plain so the shopping list's drag-reorder + slide animations were
untouched. The pantry already calls `prepareForLayoutAnimationRender()` on delete.

**Device result (user):** "deletion works but it jumps a little instead of sliding up." The reflow
does not animate.

**Root cause:** `PantryContent` feeds FlashList through `useDeferredValue(sortedItems)` — a
deliberate **performance** optimization. A delete therefore lands across two React commits: the
synchronous `prepareForLayoutAnimationRender()` arms one commit, but the row actually disappears in
the *deferred* (low-priority) commit, which is no longer armed → FlashList repositions instantly =
the jump. The cell `layout` prop alone can't bridge that.

**Decision: reverted** `AnimatedCellRenderer.tsx` + `PantryContent.tsx` to original. A real slide
would require removing/bypassing `useDeferredValue` on the delete path — trading away a real perf
optimization for a polish animation. Not worth it; left as a documented backlog item (would need a
delete path that commits synchronously, or moving the reflow concern into the swipe-delete component
itself). validation: typecheck ✅ · lint ✅ · tests ✅.

**Net:** Phases 1–4 (with the tab-regression fix + smooth tab centering) are the shipped premium
deliverable. Phase 5 (list reflow) stays blocked on the `useDeferredValue` rework; Phase 6 (scrim
migration) and Phase 7b (token guards) remain documented backlog.

#### Phase 5 — second attempt: row-collapse ("Variant B"), reverted ⏸️

**Approach (agent-validated):** keep the UI-thread slide+fade, then on animation finish set a
`collapsed` (`height: 0`) flag stored in FlashList's `useRecyclingState` (its setter triggers the
`layout()` commit that reflows rows below — a UI-thread Reanimated height change is invisible to
FlashList's layout manager and just leaves a gap), then drop the row from data on the next frame via
`requestAnimationFrame(() => onDelete(id))`. Three parallel agents validated this over the per-frame
collapse ("Variant A", rejected as janky).

**Why reverted:**
1. **New failure mode on a failed/reverted delete.** `collapsed` is keyed by `itemId` in
   `useRecyclingState`, which only resets the flag when the cell is *recycled for a different item*.
   If a delete mutation fails and the item reappears in the **same** cell instance (same `itemId`),
   the reset never fires → the row stays `height: 0` = an invisible zero-height row. The
   slide-and-fade baseline doesn't add a persistent React height state, so it doesn't have this hole.
2. **Could not be cleanly device-verified.** The test sessions were repeatedly disrupted by a flaky
   emulator API connection (`adb reverse tcp:4000` dropping → **"Network request failed"**) and an
   unrelated **manual Logout** (the profile Logout button clears the persisted cache by design), which
   made it impossible to isolate the animation's behavior. Per project discipline (*validate before
   committing; if unsure, don't ship*), shipping an unverified change that adds a failure mode is the
   wrong trade.

**Decision: reverted** `PantryItemCard.tsx` to the committed slide-and-fade baseline (code now
identical; only comments improved to document the recycle-reset covering the reappear case).
validation: typecheck ✅ · lint ✅ · PantryItemCard tests 11/11 ✅.

**Diagnostic note (out of Phase 5 scope → candidate future phase):** the "delete broke the app"
report traced to **network resilience**, not the delete path. On a transient "Network request failed"
the pantry list went empty (`items=0`) while the header count stayed `11` (`totalCount` from cache).
Commit `8408d9aa` ("keep auth/cache valid on offline or unreachable API") was meant to prevent the
cache from emptying on an unreachable API — this looks like a gap worth a dedicated investigation,
but it is unrelated to the list-motion work and is logged here rather than fixed in-phase.

### Phase 7 — Enforcement (ESLint import bans + `any`-warning root-cause fix) ✅

To make the consistency *stick*, lint now enforces using the atoms/re-exports instead of raw RN
primitives — protecting the typography (Phase 3) and pressable (Phase 8) work from regressing.

**Rule (`.eslintrc.js`, global `no-restricted-imports`):** ban VALUE imports of `Text`, `Pressable`,
and `TouchableOpacity/Highlight/NativeFeedback/WithoutFeedback` from `'react-native'`. Message points
to `#components/atoms/Text`, `#components/atoms/themedComponents` (or `AppPressable`/`PressableScale`
for feedback, or RNGH's `Pressable` for gesture composition). Type-only imports (`type TextStyle`,
`PressableProps`) stay allowed.

**No `eslint-disable` anywhere** (owner directive). The 2 canonical re-export atoms that *must* import
the primitives they wrap (`themedComponents.tsx` → `Pressable`, `atoms/Text.tsx` → RN `Text`) are
exempted via a **config `overrides` block**, not inline disables.

**Fix-up: 56 files** flagged (23 production + 33 test). Migrated by **5 parallel agents** on disjoint
file sets (production: visual-preserving — `atoms/Text` applies the typography line-heights, which is
the intended consistency; tests: drop-in). Result: **lint 0 errors**.

**`any`-warning root-cause fix (the 6 `no-explicit-any` warnings → 0):** these were in the
subscription service, stubbed with `any` instead of typed from Apollo's actual hook types. Root cause
fixed (not `unknown` band-aids):
- `SubscriptionHandlers.onData` → `useSubscription.OnDataOptions<Record<string, unknown>>` (the
  non-deprecated AC4 namespace type; the top-level `OnDataOptions` is `@deprecated`). The service
  extracts the payload field generically, so the open `Record` form is the correct erased-generic
  shape (assignable from any concrete `OnDataOptions<TSubscription>` when spread into `useSubscription`).
- `onData`/`customOnError` error params → **`ErrorLike`** (the impl already used it).
- `register<TData = unknown>` (matches Apollo's own generic-default convention).
- Cascade contained to 2 test files: a single typed `reg()` wrapper in `SubscriptionService.test.ts`
  + a sanctioned test cast (the lint config permits mock casts in tests); `telemetryLink` test
  `{ request: any }` → typed `RunRequest`.

**Deferred → Phase 7b (NOT cleanly lint-enforceable):** raw-hex→token and raw-numeric-spacing→token
guards. A blanket rule flags legitimate hex (Skia/charts/color-picker data) and numeric values that
map to *no* token without changing the rendered look — so these need a curated cleanup pass, not a
lint rule that would block the gate with un-fixable false positives.

**Validation:** `npm run test` ✅ **5985/5985** · `npm run lint` ✅ **0 errors, 0 warnings** ·
`npm run typecheck` ✅ **0 errors**.

---

## Final status (2026-06-02)

**Shipped & validated:** Phases 1–4 (flicker/transitions, tactile feedback, typography + elevation,
refinement) · Phase 7 (enforcement + `any` root-cause fix) · Phase 8 (pressable centralization
`AppPressable`+`PressableScale`, `SegmentedControl` reuse, `SettingRow` dedup). All device-verified
where visual; full suite, lint (0 warnings), and typecheck all green.

**Backlog:** Phase 5 (list reflow — both the cell-`layout` and the row-collapse approaches were
attempted and reverted; needs a delete path that commits synchronously, i.e. a `useDeferredValue`
rework, before the reflow can animate) · Phase 6 (scrim/alpha token migration, ~40 files) · Phase 7b
(hex/spacing token guards, curated).

### Cache resilience — transient connection loss no longer wipes the pantry ✅ (2026-06-02)

**Symptom:** deleting a pantry item (or merely losing the API connection) intermittently emptied the
whole list — header still showed "N items" (from `Pantry.stats`, preserved) while the list went blank.

**Two root causes, both confirmed:**
1. **Dev-only:** `adb reverse tcp:4000` kept dropping because two adb versions were installed — the
   Debian `adb` package (v34) and Android Studio's SDK adb (v37). A client/server version mismatch
   makes adb kill+restart the server, which wipes all `reverse` forwards → the emulator lost the API.
   Fixed by removing the stale Debian `adb` so only the SDK v37 remains.
2. **Real app bug:** `Pantry.itemsConnection` is the only cache field with an *active replace rule*
   (`cache.ts` `itemsConnectionFieldPolicy.merge`: `return incoming` on a page-1 fetch with
   `hasNextPage` falsy). The pantry is single-page in practice (`first: 50`), so every refetch hit
   that path — and a transient/partial response with **empty edges** replaced the populated cache,
   emptying the list. Every *other* cached field (stats, home, profile, entities) survived because
   Apollo only updates plain fields, never wipes them.

3. **The actual culprit — a HOOK-level ordering defect (found via live diagnostics).** The cache was
   never wiped: on a failed fetch `errorPolicy: 'ignore'` returns `data === undefined`, but the hook
   did `usePreservedArrayData(extractNodes(connection))` — `extractNodes(undefined) === []` flattened
   the "no data" signal to an empty array **before** preservation ran, so the preservation (which only
   keys off `undefined`) never fired and the list rendered empty. `stats` survived only because it was
   preserved *before* any transform. Compounded by a second defect in `usePreservedQueryData`: it
   initialized `prevData = currentData`, so on a cold start (cache resolves synchronously on render #1)
   the **first** value was never stored — a later error had nothing to preserve.

**Fixes (validated against Apollo's official guidance to preserve at the raw data/connection level):**
- **New centralized `usePreservedConnection` / `usePreservedNodes`** (`src/hooks/apollo/`) — preserve
  the connection OBJECT across `undefined`, THEN derive nodes/totalCount/pageInfo. The flatten
  (edges→nodes) is correct and Apollo-standard; only its ORDER relative to preservation was wrong.
- **`usePreservedQueryData`** now initializes `prevData = undefined` so the first (cold-start) value is
  always stored. Strict improvement — fixes latent cold-start wipes in every consumer.
- **Migrated 8 hooks** off the buggy `usePreservedArrayData(extractNodes(…))` pattern: `usePantryQuery`
  (+ pagination/totalCount preserved), the shared `useConnectionData`, `useItemSelector`, `useHomeQuery`,
  `useDefaultHome`, `useCurrentPantry`, `useLazyHomeData`, `useStorageLocationManagement`.
- **Defense-in-depth:** the `itemsConnectionFieldPolicy.merge` guard stays — when incoming has no edges
  but existing is populated, preserve cached edges unless the server authoritatively reports
  `totalCount === 0`. Guards a *partial cache write* (the hook fix guards the `undefined` read).

**Validation:** full suite **503 suites / 5992 tests** ✅ (incl. new `usePreservedConnection` + cache
guard tests) · typecheck ✅ · lint ✅. The flatten question was explicitly validated against Apollo
docs (relay connections require flattening; Apollo doesn't auto-flatten; `data ?? previousData` /
preserve-before-transform is the idiomatic pattern).
