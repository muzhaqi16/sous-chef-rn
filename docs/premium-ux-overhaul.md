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
| 7 | Token enforcement — ESLint guards + spacing-scale purification + raw-`Text` migration | ⬜ Not started (deferred from P3, depends on P6) |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⏸️ Blocked

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
deliverable. Phases 5 (this), 6 (scrim migration), 7 (enforcement) remain documented backlog.
