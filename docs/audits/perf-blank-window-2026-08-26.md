# Blank-list window after data load — measurement + fix audit (2026-08-26)

Follow-up to `perf-offline-baseline-2026-08-24.md` (device baseline, four
rejected hypotheses, Hermes attribution). This audit measures and fixes the
user-visible blank window on PantryMain / ShoppingListMain: after the skeleton
disappears, the list body (including the sticky FilterTabs sentinel row) stays
invisible while the header chrome is already painted.

## Root cause (library source, `@shopify/flash-list@2.3.2`)

FlashList v2 renders its initial cells progressively (~`initialDrawBatchSize=2`
cells per commit→measure→setState pass, `RecyclerViewManager.ts:405-441`) and
holds the ENTIRE cell container at `opacity: 0` until the loop finishes and
`commitLayout()` runs (`ViewHolderCollection.tsx:152-161` —
`opacity: renderId > 0 ? 1 : 0`). `ListHeaderComponent` renders OUTSIDE that
container and paints on the first commit; the pantry's FilterTabs are row 0 (a
sticky sentinel cell) INSIDE it — which is why the header, search bar and
stats row paint while tabs + rows are invisible together. The window is long
because each pantry row is expensive to mount (~30 elements, 8-9 Reanimated
`Animated.View`s, ~14 shared values, 2 RNGH GestureDetectors), and it is
VISIBLE because skeleton dismissal is tied to Apollo loading state, which
flips in the same commit that starts the row-mount loop.

Signal for the fix: `onLoad` / `isFirstLayoutComplete` latch ONCE per mount
(the sentinel-only skeleton layout consumes them before data arrives —
`useOnLoad.ts:72-79`); the public `onCommitLayoutEffect` prop re-fires on
every stable-layout commit including the ones after a data change
(`RecyclerView.tsx:613-619` → `ViewHolderCollection` `renderId` layout
effect). Upstream docs: Layout Commit Observer.

## Protocol

SM-S908U1 (`R5CT51KPEBM`), Android 36, `localRelease`, warm cache, signed in
as `test@souschef.dev`, "Home Sweet Home" pantry, **67 items** (55 shopping /
24 purchased on the 8130 Groceries list). Thermal status 0, battery saver off.
Tree: `f930bf3c` + uncommitted work (`git diff | sha1sum` =
`48dfe1a0dec0e3d63b4d6e280b82357b9238445a` at baseline build; includes the
`hasRealContent: !initialSkeletons` measurement/presentation split from the
parallel session, so `app_fully_drawn_ms` has NO 280 ms floor in any build
measured here).

Per run: `am force-stop` → `screenrecord` (60 fps, device-native VFR;
resolution one frame ≈ 17 ms) → `am start -W` → logcat
`ActivityTaskManager: Fully drawn` (per-run, wall clock, activity-start
origin) → scripted List-tab tap at fully-drawn+2 s (captures the shopping
list's first-mount window in the same recording) → 15 s alive for the 10 s
metric flush → per-session Mimir reads (`device_type="physical"`,
`version="4.3.11"`; each cold start is a new process, so only the last flush
is visible — values below are per run, never aggregated).

Video phase detection: ffmpeg `signalstats` YAVG on two crops (header band
y 3-12 %; body band y 30-85 %, x 5-95 %). The blank body reads a flat
`YAVG = 42.0` (uniform app background) — distinct from launcher (~129),
splash (~57), skeleton fallback (~63 body / 46 header) and populated rows
(~62-67 body). Signatures calibrated against extracted frames by eye.

## Baseline — n=5

Video timeline, relative to splash appearing (~250 ms after `am start`):

| phase | runs 1-5 |
|---|---|
| app first frame (blank, pre-skeleton) | +0.80–0.89 s, lasting ~190–208 ms |
| DeferredScreen skeleton visible | +1.01–1.09 s (≈250–300 ms long) |
| **header-only blank window** | **322 / 333 / 300 / 342 / 308 ms** (median 322) |
| rows painted | +1.55–1.68 s |
| List-tab first-mount blank | 176 / 209 / 183 / 183 / 192 ms (median 183) |

Note the device DOES paint the DeferredScreen skeleton on this build (the
2026-08-24 baseline saw none); the blank window opens when the skeleton is
REPLACED by the header-only frame, exactly the mechanism sequence.

Per-run instruments (metrics n=4 — run 5's read raced the flush):

| run | OS Fully drawn | `app_fully_drawn_ms` | `flashlist_initial_load_ms` Pantry | Shopping | `app_content_appeared_ms` |
|---|---|---|---|---|---|
| 1 | 2117 ms | 1854 | 302 | 200 | 475 |
| 2 | 2083 ms | 1846 | 318 | 212 | 441 |
| 3 | 2025 ms | 1777 | 289 | 200 | 449 |
| 4 | 2136 ms | 1854 | 352 | 199 | 494 |
| 5 | 2110 ms | — | — | — | — |

The video blank window (300–342 ms) and `flashlist_initial_load_ms`
(289–352 ms) agree within one sample — consistent with the blank window BEING
FlashList's progressive first layout.

## Control — per-cell instrumentation disabled (regression-triage §B2)

Temporary patch: `useFlashListPerformance` returns
`CellRendererComponent: undefined` (FlashList falls back to its plain-View
`CompatView`) and `evaluateBlankState` no-ops. Same tree otherwise. n=5 after
a discarded probe.

| run | blank window (video) | `flashlist_initial_load_ms` Pantry | Shopping | OS Fully drawn |
|---|---|---|---|---|
| 1 | 275 ms | 264 | 186 | 1992 ms |
| 2 | 182 ms | 249 | 181 | 2072 ms |
| 3 | 216 ms | 278 | 197 | 2052 ms |
| 4 | 434 ms | 355 | 260 | 2445 ms |
| 5 | 500 ms | 393 | 267 | 2565 ms |

**Runs 4–5 are contaminated and discarded**: every phase degraded together —
pre-list blank longer, skeleton later (+1.29/+1.36 s vs +1.05 s), shopping
window up too — and `dumpsys thermalservice` read **Thermal Status 1** after
the set (battery 34.6 °C; it was 0 at baseline). That is device throttling
from ~20 minutes of continuous runs on charge, not the patch.

**Verdict (runs 1–3 vs baseline):** removing the per-cell instrumentation
saves ~30–60 ms of the ~320 ms pantry window and ~15 ms of the shopping one —
real, worth shipping as sampling (triage §B2), but NOT the dominant share. The
dominant cost is the row mounts themselves. Rule applied: attribution stated
with its confounder; no re-run scheduled because no decision here depends on
tighter resolution.

Protocol addendum: check `dumpsys thermalservice` BEFORE and AFTER each
measurement set; discard sets whose thermal status changed, and let the device
return to status 0 before the next set.

## Fix — skeletons release on FlashList's first content layout (Phase 1)

`useFlashListPerformance` now exposes the list's real paint signal:
`onCommitLayoutEffect` (passed to the FlashList) latches `hasContentLayout` —
and fires an optional `onFirstContentLayout` — on the first layout commit that
lands while `hasRealContent` is true. Sentinel/skeleton layouts don't latch
(`hasRealContent` false); the commit after the data change does, because
FlashList re-fires `onCommitLayoutEffect` on every stable layout commit
(verified: `ViewHolderCollection.tsx` fires it from the `renderId` layout
effect; `commitLayout()` increments `renderId` at the end of every settled
pass).

- **Pantry** (`PantryContent.tsx`): new `PantryListSkeletonOverlay` — an
  opaque cover below the measured header chrome (real `PantryStickyTabs` + 8
  skeleton rows), shown while `useMinimumVisible(initialSkeletons ||
  !hasContentLayout)` holds, exiting via `FadeOut`. Data handoff to FlashList
  is now gated on the UN-SMOOTHED `initialSkeletons` (the 280 ms
  anti-flash minimum moved onto the overlay), so rows mount under the cover
  up to 280 ms earlier. The footer-skeleton path (`switching && fetching` +
  initial network loading) is unchanged. `hasRealContent` stays
  `!initialSkeletons` — never derived from overlay visibility (deadlock).
- **Shopping tabs** (`ShoppingTab.tsx` / `PurchasedTab.tsx`): the existing
  skeleton overlay now also waits for `listPainted` (via
  `onFirstContentLayout` threaded through `StaggeredTabContent` →
  `SortableList`) whenever `items.length > 0`; a settled empty list releases
  without the paint signal (its `hasRealContent` never fires).
- Jest FlashList mock fires `onCommitLayoutEffect` after every commit.

### Intermediate set (DISCARDED for pantry, VALID for shopping) — first overlay attempt

The first pantry overlay was a FlashList *sibling* gated on a measured header
height (`onLayout` → `setState` → render). n=5 on device:

- **Shopping fix verified**: the List-tab blank episode is GONE in 5/5 runs
  (baseline 176–209 ms → none detected). Its skeleton needs no measurement —
  it exists from the tab's first commit and only its *release* waits on the
  paint signal.
- **Pantry overlay never appeared**; the blank grew to 658–716 ms. Mechanism
  (this is the lesson): any cover whose MOUNT depends on a post-first-commit
  state update (`onLayout`, a deferred flag) is starved behind exactly the
  JS-thread storm it exists to cover — the header's `onLayout` round-trip
  queued behind FlashList's progressive commit loop and lost. Rewritten as an
  absolutely-positioned flap INSIDE `ListHeaderComponent` (`top: '100%'`,
  screen-height tall): it paints in the same first commit as the chrome, needs
  no measurement, and needs no zIndex — the cell container is a LATER sibling,
  so the instant cells turn opaque they paint over the flap, making the reveal
  independent of the (equally starvable) release state update.
- **Anomaly, unresolved**: OS `Fully drawn` rose to 4429–4531 ms in all 5
  runs while `app_fully_drawn_ms` (JS-entry origin, the JS-side latch) stayed
  ~2045–2121 ms and the video shows rows at the normal time — i.e. the JS →
  native `reportFullyDrawn` hop, not the latch, gained ~2 s. This build is
  also the first containing the babel plugin reorder (unistyles before
  compiler, landed by a parallel session at 20:07); baseline/control predate
  it. Attribution pending the flap build: if the OS-line lag survives a build
  with the sibling-overlay churn removed, the babel reorder is the remaining
  candidate.

### After — flap build, n=5 (probe discarded)

| run | pantry blank | shopping blank | `flashlist_initial_load` Pantry / Shopping | `app_fully_drawn_ms` | OS Fully drawn |
|---|---|---|---|---|---|
| 1 | **none** | **none** | 375 / 526 | 1981 | 2450 |
| 2 | **none** | **none** | 374 / 606 | 1980 | 2472 |
| 3 | **none** | **none** | 332 / 737 | 1892 | 2332 |
| 4 | **none** | **none** | 358 / 717 | 1930 | 2384 |
| 5 | **none** | **none** | 351 / 742 | 1842 | 2390 |

**The user-visible defect is gone: zero blank episodes on either screen in all
five runs** (baseline: pantry 300–342 ms, shopping 176–209 ms, 5/5 runs each).
Frame-verified: the previously blank region shows the real header, real
FilterTabs and skeleton rows until the rows-frame; the shopping tab shows its
skeleton until rows. Only the pre-JS app-first-frame blank remains (166–199 ms
— identical at baseline, exists before any JS content, out of scope).

Costs, with confounds stated:

- `app_fully_drawn_ms` 1842–1981 vs baseline 1777–1854: **+~80 ms median** —
  the flap mount plus the latch's extra commit, inside the measured window.
- OS `Fully drawn` 2332–2472 vs baseline 2025–2136: +~250 ms, but this build
  also carries the babel plugin reorder (landed mid-session by a parallel
  session; every "after" build has it, no "before" build does) — the ~170 ms
  beyond `app_fully_drawn_ms`'s shift is unattributed between babel and the
  activity-start→JS-entry segment. NOT re-measured here: separating it needs
  a babel-only build, which is the reordering session's own A/B to run.
- `flashlist_initial_load_ms` SortableShoppingList 526–742 vs baseline
  199–212: partly REAL DEFINITION SHIFT — the metric's window now contains
  the skeleton-overlay teardown the latch schedules at exactly the measured
  boundary (contract row updated); partly a mount-time increase whose babel
  share is unattributed (the intermediate build measured 297–313 on an idle
  thread); partly a warming trend across the set (526→742). The first tab
  visit now shows skeleton-then-rows instead of a blank; its time-to-rows on
  a busy post-launch thread is longer than the blank was. If that reads as
  sluggish in use, the lever is Track-2 row lightening, not reverting the
  cover.
- Pantry `flashlist_initial_load_ms` 332–375 vs 289–352: within the baseline
  run spread once the latch commit is included.

A later polish (after this set): the overlay's 280 ms `useMinimumVisible`
hold was removed — the 200 ms exit fade is the anti-flash smoothing, and the
latch cannot fire before rows exist, so the minimum only ever delayed
genuinely-fast reveals. Effect: overlay lingers ≤1 frame + fade past the
rows-frame instead of up to 280 ms. (Not re-measured on device; strictly a
shortening of overlay linger after the reveal.)

## Instrumentation cost made a policy (Phase 2.1)

Per the control: `flashListInstrumentationSampleRate` (dev 1.0, release 0.05)
decides ONCE PER LIST MOUNT whether the per-cell `MountedCellRenderer` +
blank-state evaluation arm. Unsampled sessions hand FlashList
`CellRendererComponent: undefined` (plain-View cells) and skip
`evaluateBlankState`; `flashlist_initial_load_ms`, session duration and the
first-content-layout latch stay unsampled. `useCommitTracking`'s release
emission dropped to 0.2. Contract rows updated in `docs/telemetry-setup.md`.

## Deferred (measured next, not assumed)

- **Track-2 row lightening** (defer `ReanimatedSwipeable` mount until first
  content layout): the control says rows, not instrumentation, dominate the
  ~320 ms layout window, and the shopping tab's longer time-to-rows raises
  its value. Run with a Hermes profile per the standing rule.
- **Phase-3 first-paint A/Bs** (`INITIAL_RENDER_WINDOW` 24→12; dynamic small
  `drawDistance` until first content layout): the post-reveal buffer burst is
  now invisible behind the skeleton, so these are latency-to-interactive
  levers, not blank levers. Deferred rather than run tonight because the
  measurement environment is confounded (babel reorder mid-session, thermal
  drift after ~40 min of continuous runs); prediction to test when run:
  window 24→12 trims the post-reveal mount burst from ~14 rows to ~2 with no
  change to the reveal itself.
- **Babel-reorder attribution** on OS `Fully drawn` and shopping mount time —
  belongs to the reordering session; flagged to it with the numbers above.
  **Partial answer received (static control, same session):** `SortableItem.tsx`
  contains no `useVariants` and compiles byte-identical under both plugin
  orders, so the reorder CANNOT explain the shopping-row shift — the overlay
  teardown inside the metric window (plus thread/thermal state) stands as the
  explanation there. `PantryItemCard.tsx` gains +1 compiler cache slot under
  the new order (+272 slots across the 53 affected files repo-wide, +8.3%) —
  a small real mount-work increase to keep an eye on for pantry rows. The
  ~170 ms in the activity-start→JS-entry segment remains unmeasured either
  way; the on-device babel-only A/B is queued in that session pending its
  user's approval and device time.
