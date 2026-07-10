# Global Backdrop Lifecycle — Design Proposal

**Status:** Proposal (no code yet) · **Owner:** TBD · **Date:** 2026-06-25

## 1. Problem

The dim/blur backdrop behind bottom sheets intermittently **leaks** — it stays
on screen (or blocks taps invisibly) after the sheet is gone, most often after
navigating away from a screen with an open sheet and back. It recurs because the
fix so far has been to keep adding defensive release paths rather than changing
the model.

Recent work migrated RecipeMain / RecipeDetail sheets to the `visible`-prop path,
which fixed the **sheet** staying open. It did **not** touch the **backdrop
claim**, which is a separate mechanism. That is what still leaks.

## 2. Current architecture (two models, one shared curve)

| Concern | File |
|---|---|
| Global dim slot registry (max-opacity over claims) | `OverlayBackdropProvider.tsx` |
| Index→opacity curve (shared) | `useSheetBackdropOpacity.ts` |
| **Imperative** claim (47 sheets) | `useBottomSheetBackdropClaim.ts` ← via `useStandardBottomSheet` |
| **Declarative** claim (1 consumer) | `useBackdropClaim()` in provider ← `ActionTray` |

- **Imperative (47 sheets):** claims on gorhom `onAnimate(toIndex≥0)`, releases on
  `onChange(-1)`, with two extra defensive releases (`safeOnDismiss`, unmount
  cleanup). Slot identity tracked in a single `claimIdRef`.
- **Declarative (ActionTray):** `useBackdropClaim(active)` ties the slot to React
  state; release is a `useEffect` cleanup. Provider docstring: *"There is no
  manual decrement to leak."*

Both consume the same `interpolate(animatedIndex, [-1,0] → [0, BACKDROP_OPACITY])`
opacity SV, so the dim and the floating tab bar (`useOverlayBackdropOpacity`)
never drift. **Only the curve is shared; the lifecycle models differ.**

## 3. Root cause — why the imperative model leaks

1. **Release depends on gorhom events that gorhom documents as skippable.**
   `ActionTray.tsx:87-96` and `OverlayBackdropProvider.tsx:204-212` both note
   gorhom **skips `onChange(-1)` when a close interrupts an open that never
   settled.** Needing three stacked backstops (`onChange(-1)` + `safeOnDismiss` +
   unmount cleanup) is the smell that the model is wrong.
2. **Single-`claimIdRef` coalescing → interleaving race on fast navigation.**
   `claimBackdrop` does `if (claimIdRef.current != null) return`, and release is
   keyed to that one id. Navigate-away-and-back quickly: claim `5` → re-focus
   reuses `5` (skip) → the *stale* dismiss's `onChange(-1)` releases `5` while the
   sheet is open again. The focus-awareness (`present` on focus / `dismiss` on
   blur) we now rely on makes this **more** frequent, not less.
3. **Frozen external SV.** The opacity SV is owned by the sheet. If its slot is
   never released, the provider keeps reading a frozen, non-zero value → permanent
   dim.

## 4. Best-practice comparison

- **Gorhom built-in (`backdropComponent` + `BottomSheetBackdrop`,
  `appearsOnIndex/disappearsOnIndex`):** gorhom owns the lifecycle per sheet;
  leak-proof; simplest. **Rejected** here because a single global backdrop is
  required so the floating tab bar can read one shared opacity SV. (Could be
  reconsidered if we solve the tab-bar coupling separately.)
- **Declarative state-bound claim (senior-dev recommendation):** bind backdrop
  lifetime to React state via effect cleanup, never to imperative event handlers.
  This is what `useBackdropClaim` / ActionTray already do and why ActionTray
  doesn't leak. **This proposal adopts it for all sheets.**

## 5. Proposed design

Make the sheet backdrop **declarative**, driven by an `active` boolean computed
from `visible` (now the reliable source of truth post-migration) — not from
gorhom's interleaving events. `useBottomSheetBackdropClaim` becomes a thin wrapper
over `useBackdropClaim(active, { opacity: backdropOpacity, onPress })`.

### 5a. `active` state machine (per sheet)

```
visible = true              → active = true            (claim; dim ramps in via SV)
visible: true → false       → start closeTimer(d); active stays true
closeTimer(d) elapses       → active = false           (release via effect cleanup)
visible: false → true       → cancel closeTimer; active = true  (reuse slot, no flicker)
component unmount           → effect cleanup releases   (GUARANTEED by React)
onChange(-1) [optional]     → may fire closeTimer early for promptness
```

- `d` = the sheet's actual close-animation duration (from
  `useSharedBottomSheetConfigs`), not a hardcoded constant. `BACKDROP_FADE_OUT`
  (300ms) is the fallback proxy.
- The **claim** still registers at open start (so the dim ramp is synchronous) —
  driven by `visible:false→true`, which commits on the same render as `present()`.

### 5b. Close-animation fade (the tricky part)

The visible fade is produced by the **opacity SV** (gorhom drives `animatedIndex`
0→-1 → SV → 0), *independent of slot lifetime* — as long as the slot stays
registered while the SV ramps. So on `visible→false` we keep `active=true` for
`d`, letting the SV fade, then release. The release is **deterministic** (timer +
unmount cleanup), so it no longer depends on gorhom firing `onChange(-1)`. That
event becomes an *optimization* (release a few ms sooner), not a *correctness
requirement*.

### 5c. Why this kills all three failure modes

| Failure mode (§3) | Eliminated by |
|---|---|
| Skipped `onChange(-1)` | timer + effect-cleanup release; gorhom event no longer required |
| `claimIdRef` coalescing race | `useBackdropClaim` manages claim/release by `active` transitions; fast reopen cancels the pending release |
| Frozen external SV | slot is always released (timer or unmount), never stranded |

## 6. Edge cases

- **Manual-presentation sheets (`visible === undefined`).** A handful don't pass
  `visible` (e.g. `FolderPicker` manage sub-sheet, which borrows the picker's
  `modalProps`). For these, derive `active` from a gorhom-index state instead of
  `visible`, or migrate them to `visible`. Must be enumerated before rollout.
- **Snap between detents (index 0→1→0).** `active` must not toggle on
  intra-open snaps — it keys off `visible`/closed, not every index change.
- **Timer/animation mismatch.** Too short → dim pops before the sheet finishes
  closing; too long → dim lingers. Bind `d` to the real `animationConfigs`
  duration. `onChange(-1)`, when it fires, short-circuits the timer.
- **Keyboard-aware sheets** that snap on keyboard hide must not be treated as a
  close.

## 7. Migration plan (incremental, low-risk)

1. **Phase 0 — implement behind the existing surface.** Rework
   `useBottomSheetBackdropClaim` internals to the `active`/timer model and accept
   `visible` from `useStandardBottomSheet`. The hook's public return
   (`animatedIndex` / `onChange` / `onAnimate`) stays, so call sites don't change.
2. **Phase 1 — validate on 2–3 high-traffic sheets** (RecipeMain filter,
   AddToPantrySheet) plus the navigate-away-and-back repro. ActionTray stays as
   the untouched declarative reference.
3. **Phase 2 — automatic rollout.** All 47 sheets route through
   `useStandardBottomSheet`, so the single hook change covers them at once.
4. Enumerate and convert/whitelist the `visible === undefined` manual sheets
   (§6) before declaring done.

## 8. Rollback

Change is localized to `useBottomSheetBackdropClaim.ts` + a one-line `visible`
hand-off in `useStandardBottomSheet.tsx`. Rollback = `git revert` of those two.
Optionally gate behind a constant flag during Phase 1 for instant fallback.

## 9. Verification

- Manual repro: open each sheet type → navigate away mid-open and back, rapidly,
  ×10 → assert no stranded dim and no tap-blocking invisible overlay.
- Existing suites (`BottomSheetAction`, `RecipeMain`, `RecipeDetailScreen`,
  ActionTray) stay green.
- Consider a test that drives `visible` true→false→true within the close window
  and asserts the provider ends with **zero** slots.

## 11. Central overlay-presence model (backdrop ⇄ tab bar)

Before migrating the 47 sheets, unify the coordination. Today "an overlay is
covering the screen" is expressed through **three overlapping channels**:

| Channel | Source of truth | Consumed by | Set by |
|---|---|---|---|
| **Backdrop opacity SV** | `OverlayBackdropProvider` slots → `useOverlayBackdropOpacity` | dim layer **and** `FloatingTabBar` hide (`FloatingTabBar.tsx:95,121-133`) | every backdrop claim (47 sheets imperatively, ActionTray/selectors declaratively) |
| **`isOverlayOpen` bool** | `TabBarActionsContext` (`setOverlayOpen`) | `FloatingTabBar` — only to reset `scrollTabBarHidden` on open (`:106-110`) | **only** custom selectors via `useSelectorManagement`; the 47 sheets never set it |
| **`scrollTabBarHidden` SV** | `TabBarActionsContext` | `FloatingTabBar` scroll-hide spring | per-screen scroll handlers |

### Problems with the split

1. **Redundant presence signal.** The tab bar already hides off the backdrop
   opacity SV — for sheets *and* selectors (selectors claim via
   `ActionTray` `enableBackdrop`). So `isOverlayOpen` duplicates information the
   provider already has (`slots.length > 0`, exposed as `isVisible`).
2. **Inconsistent coverage.** Only selectors call `setOverlayOpen`, so the
   "reset scroll-hide when an overlay opens" guarantee **doesn't apply to the 47
   sheets**. A sheet opened while the bar is scroll-hidden relies on `max()`
   masking it rather than an explicit reset.
3. **Imperative timing hacks.** `useShoppingListSelectorModal` calls
   `setOverlayOpen(false)` *before* navigating (`:365-393`) to force the bar back
   — a manual workaround for the same race the declarative model removes.

### Target: the backdrop provider IS the overlay-presence registry

One claim → three coordinated effects, automatically:

```
useBackdropClaim(active, { opacity, onPress, hidesTabBar? })
   │
   ├─ contributes opacity SV → global dim (existing)
   ├─ opacity SV → FloatingTabBar hide   (existing, lockstep)
   └─ slots.length>0 → "overlay present" → scroll-hide reset   (NEW: derived, not manual)
```

Concretely:
- **Delete `setOverlayOpen` / `isOverlayOpen`** from `TabBarActionsContext`.
  `FloatingTabBar` reads overlay presence from the provider's existing `isVisible`
  (`OverlayBackdropInternalContext`) instead of `useTabBarState().isOverlayOpen`.
  The scroll-hide reset (`:106-110`) then fires for **all** overlays, sheets
  included — fixing problem #2.
- **Remove the `setOverlayOpen` calls** from `useSelectorManagement` and
  `useShoppingListSelectorModal`; presence is implied by the claim. The
  "set false before navigate" hack disappears — `active` flips false when the
  selector dismisses/blurs and the claim releases via effect cleanup.
- All overlays (sheets + selectors) end on the **same declarative claim**. Sheets
  reach it through the §5 `useBottomSheetBackdropClaim` rework; selectors already
  use `useBackdropClaim` via `ActionTray`.

### Optional refinement

If some overlays should dim but **not** hide the tab bar (or vice-versa), add a
`hidesTabBar` flag to the claim and have the provider expose a second derived SV
("tab-bar-hiding coverage") separate from "dim coverage." Not needed today (every
current overlay both dims and hides the bar), but the seam keeps that decision in
one place instead of scattered booleans.

### Net effect

`TabBarActionsContext` sheds two fields and a setter; selectors shed their manual
overlay calls; the provider becomes the single source of truth for overlay
presence that the dim layer, the tab bar, and scroll-hide all derive from. The
§5 robustness rework and this unification are the **same migration** — both
collapse coordination onto the declarative claim.

## 12. Validation findings → revised design (v2)

Three independent reviews (validate / refute / docs-and-best-practices) agreed the
v1 mechanism in §5 is **unsound**. Summary of blockers and the revision.

### Blockers found in v1

- **B1 — `visible` ≠ on-screen state.** `useStandardBottomSheet`'s focus-awareness
  (`:204-223`) dismisses/re-presents imperatively **without touching `visible`**.
  So on navigate-away (the headline bug) `active = visible` stays true, the screen
  stays mounted, the slot stays registered → invisible tap-blocker. `active=visible`
  does **not** fix the leak. ActionTray works only because its `mounted` *is* torn
  down on blur; `visible` is not.
- **B2 — manual sheets get no backdrop, and the close timer can't be tuned.**
  `active = visible || closing` collapses to `closing` (false on open) for
  `visible===undefined` sheets (a documented, supported pattern) → strips their dim.
- **B3 — `d` can't bind to the animation config.** `useSharedBottomSheetConfigs`
  returns a **spring** (`damping/stiffness`, no duration). A hardcoded `d` removes
  the slot while the opacity SV is still non-zero on tall snap points → the dim
  *snaps* off mid-slide, **regressing** today's perfect SV-driven fade.
- **B1′ — `isOverlayOpen` has 3 consumers, not 1.** Besides the scroll-hide reset,
  `PantryMain.tsx:349` and `ShoppingListMainContent.tsx:450` gate **tutorial
  spotlights**. `isVisible` (slot count) is true for *all* overlays; a tutorial
  step that opens its own sheet (`PantryMain.tsx:358`) would then pause/hide the
  tutorial driving it. Wholesale `isOverlayOpen → isVisible` regresses tutorials.

### Revised mechanism (v2): drive `active` off the **animatedIndex SV**, not `visible`

The on-screen truth is the SV gorhom already drives (`useSheetBackdropOpacity`'s
`animatedIndex`). It settles to `-1` when the sheet closes **even when gorhom skips
`onChange(-1)`** (the animation/SV completes regardless — corroborated by gorhom
issues #1381/#506). So:

```ts
const [active, setActive] = useState(false);
useAnimatedReaction(
  () => animatedIndex.value > -0.999,          // on screen?
  (onScreen, prev) => {
    if (onScreen !== prev) scheduleOnRN(setActive)(onScreen); // boolean only
  },
);
useBackdropClaim(active, { opacity: backdropOpacity, onPress });
```

Why this clears every blocker:
- **B1/B1-core:** independent of `visible`/focus/mount — the SV reflects actual
  on-screen state, so navigate-away release happens when the sheet animates closed.
- **B2:** manual sheets have an `animatedIndex` too → they get the dim for free.
- **B3:** no timer, no duration constant. The slot is removed only when the SV
  crosses `-1` (opacity already 0) → today's perfect fade is **preserved**.
- **H1/H2:** no `claimIdRef`, no stale-timer race; **drop `onChange(-1)`/`onAnimate`
  release entirely** (they re-import the imperative coupling). Unmount cleanup
  (`useBackdropClaim`) stays as the guaranteed backstop.
- Complies with the `scheduleOnRN` convention (RN-scope `setActive`, primitive arg).

### Revised tab-bar / tutorial coordination (§11 corrected)

Two *distinct* meanings were conflated. Keep them separate:
- **"Screen is dimmed"** (dim + tab-bar hide + scroll-hide reset) → derive from the
  provider's `isVisible` (slot count). Tab-bar hide already reads the opacity SV;
  add the scroll-reset off `isVisible`. **H3:** this makes the reset fire for sheets
  too (open-any-sheet → bar returns to shown on close even if scroll-hid) — an
  intentional, documented behavior change, not a silent one.
- **"A blocking overlay is up for tutorials"** → **keep** `isOverlayOpen` /
  `setOverlayOpen` for `PantryMain`/`ShoppingListMainContent`, because a tutorial
  step that opens its own sheet must *not* pause itself. Do **not** delete it; only
  move the scroll-reset off it.

So §11 becomes a *partial* unification: the backdrop provider owns "screen dimmed";
the tutorial-pause signal stays explicit. Net: still removes the redundant tab-bar
hide channel, without regressing tutorials.

### Residual / out of scope
- FolderPicker manage sub-sheet shares the picker's `animatedIndex`, so v2 treats
  the pair as one presence (correct). Its dismiss→present **swap flash** is
  pre-existing (shared SV dips then rises) and is not addressed here.
- Manual `visible===undefined` sheets must still be enumerated to confirm none rely
  on the removed `onChange`/`onAnimate` claim for anything other than the dim.

> **⚠️ Post-ship correction (2026-06-26):** v3's "drop `onChange(-1)`, release only via
> the SV reaction" was wrong. A `BottomSheetMODAL` dismiss **unmounts the portal and can
> stop driving `animatedIndex` before it reaches -1**, so the reaction never fires → the
> slot leaks → an invisible backdrop eats every tap (open once, then the whole screen is
> dead). Fix shipped: `onChange(-1)` is restored as the **primary, reliable** modal
> release; the SV reaction is kept **only** as an additive backstop for interrupted
> closes. The validation missed that a modal unmounts mid-animation (it reasoned about a
> non-modal BottomSheet, which does settle at -1). See §13.1.

## 13. v2 re-validation (3 agents) → v3 refinement

Re-validation **CONFIRMED** v2 fixes the leak/close path: gorhom drives
`animatedIndex` via the spring on the UI thread independent of callbacks
(`BottomSheet.tsx:691`), and reanimated snaps to the exact `toValue` at rest with
`overshootClamping:true` (`spring.ts:135-137`); `animatedIndex` is `CLAMP`'d so the
closed anchor maps to exactly `-1`. So on **any** close — including the interrupted
case where `onChange(-1)` is skipped — the SV reaches `-1` and release fires. All
four v1 blockers stay closed. Two corrections came out of it:

1. **`scheduleOnRN` call form (runtime bug).** `scheduleOnRN(setActive)(onScreen)` is
   the old curried `runOnJS` shape; `scheduleOnRN` is **variadic** —
   `scheduleOnRN(setActive, onScreen)` (matches `OverlayBackdropProvider.tsx:308`,
   `useAnimatedPresence.ts:74`). Read the SV with `.get()`. Lint won't catch the
   curry; only runtime would.

2. **Open-claim latency (blocker).** Pure `active = f(SV) → useBackdropClaim`
   registers the slot only after a multi-stage hop (gorhom index → its reaction
   copies the SV → v2 reaction → `scheduleOnRN` → re-render → effect → `claim` →
   `setSlots` → the provider's `useDerivedValue` re-registers, `:241-248`). Until
   then the global opacity doesn't read the sheet's ramping SV, so the dim **and the
   tab-bar hide pop in several frames into the open** — regressing the synchronous
   `onAnimate` claim the current code added on purpose (`useBottomSheetBackdropClaim.ts:77-94`),
   worse under JS load. v1's "synchronous claim" reasoning doesn't carry to the SV path.

### v3 mechanism (final): synchronous imperative CLAIM, SV-driven RELEASE

Split the two halves — claiming early is never the leak; **release** is the racy
half. Keep the open claim synchronous; make only the release reliable.

- **CLAIM (open):** unchanged — `onAnimate(toIndex≥0) → claimBackdrop()` synchronously
  at animation start (no dim pop). `onChange(index≥0)` stays as the idempotent
  backstop for the `present()`-while-open case.
- **RELEASE (close):** replace the `onChange(-1)`/`safeOnDismiss` release with
  ```ts
  useAnimatedReaction(
    () => animatedIndex.get() <= -0.999,           // settled closed?
    (closed, prev) => { if (closed && !prev) scheduleOnRN(releaseBackdrop); },
  );
  ```
  The SV reaching `-1` is reliable even when gorhom skips `onChange(-1)`. Fast-reopen
  (interrupted close, SV never reaches `-1`) simply never releases → no stale-release
  race, slot reused. `releaseBackdrop` is RN-scope and arg-free → convention-compliant.
- **BACKSTOP:** the existing unmount-cleanup release stays.

Net: keeps the `claimIdRef`/imperative claim but **removes the racy release trigger**,
which is the actual leak source — without the open-path regression of the pure
declarative form.

### Other re-validation notes (handle-in-impl)
- **`isVisible` has no public reader** — only `useOverlayBackdropOpacity` is exported.
  Add `useOverlayBackdropPresence()` (returns `isVisible`) for the tab-bar scroll-reset.
- **Preserve compositions:** `useStandardBottomSheet` must keep forwarding
  `userOnChange`/`userOnAnimate` and keep `backHandler`/keyboard-snap/`safeOnDismiss`
  intact — only the backdrop's *use* of `onChange(-1)`/`onAnimate` for release is dropped.
- **FolderPicker:** keep the sequential swap gate (`:88-97,400-408`); both modals write
  the same shared `animatedIndex`, so don't let them overlap.
- **Cleanup:** `useShoppingListSelectorModal`'s `setOverlayOpen(false)`-before-navigate
  becomes tab-bar-dead once the bar reads `isVisible`; remove it.
- **Verify on device:** open-claim timing and the FolderPicker swap flash (pre-existing).

## 10. Open questions

- Bind `d` to `animationConfigs` duration vs. a single `BACKDROP_CLOSE_MS`
  constant — which is less brittle?
- Worth keeping `onChange(-1)` as the early-release optimization, or drop it
  entirely for a purely time/state-driven model (simpler, marginally less prompt)?
- Long-term: is the global backdrop still worth its complexity, or should the tab
  bar derive coverage another way so we can adopt gorhom's per-sheet backdrop?
