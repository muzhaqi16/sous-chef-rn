# Performance Monitoring Implementation

> **Partly stale — verify against `src/hooks/performance/` before using any
> example here.** Written as a phase log and not kept in step with the code.
> Known drift, as of 2026-08-25:
>
> | Named here | Reality |
> |---|---|
> | `useRenderTime` | Renamed to `useCommitTracking` (`src/hooks/performance/useCommitTracking.ts`). It reports the gap BETWEEN commits, not render cost. |
> | `useMemoryMonitor` | Deleted. Only the `MemoryMonitor` service survives. |
> | `useFilterTransition` | Deleted. |
> | `useDeferredSearch` "uses `useDeferredValue`" | It does NOT, deliberately. It debounces (150 ms). A deferred render is interruptible, which is exactly what produces `index out of bounds, not enough layouts` when the result feeds a FlashList — see `flashlist-layout-index-race.md`. |
>
> The metric list below is also incomplete — `docs/telemetry-setup.md`
> § Metric Reference is the contract, and
> `__tests__/telemetry/metricContracts.test.ts` keeps it complete. For how to
> take a measurement at all, see [§ Measurement protocol](#measurement-protocol).

## Overview

This document describes the performance monitoring infrastructure added to the Sous Chef React Native application. This system allows developers to track component render times, memory usage, and screen transition performance.

## Features

### 1. Component Render Tracking
- **Hook**: `useRenderTime(componentName, options?)`
- **Availability**: All builds. Reporting is gated by `enabled` and
  `sampleRate`, not by `__DEV__` — the production `slowRenderThreshold` of 16ms
  only means something if the hook runs there. Console output stays dev-only.
  Guarded by `useRenderTime.test.ts` ("reports in production builds").
- **Metrics Tracked**:
  - Render count
  - Average render time
  - Maximum render time
  - Last render time
- **Features**:
  - Configurable sampling rate (default: 100% dev, 20% release)
  - Slow render detection (threshold: 16ms for 60fps)
  - Automatic telemetry reporting

### 2. Memory Monitoring
- **Service**: `MemoryMonitor` (singleton)
- **Hook**: `useMemoryMonitor(componentName, options?)`
- **Metrics Tracked**:
  - Memory used (bytes)
  - Memory limit (if available)
  - Usage percentage
  - Memory delta on mount/unmount
- **Features**:
  - Periodic sampling (default: 10s intervals)
  - Warning thresholds (80% warning, 95% critical)
  - Memory leak detection (>10MB growth)
  - Uses `react-native-device-info` (`getUsedMemory()`, `getTotalMemory()`) with null return on failure

### 3. Screen Transition Tracking
- **Hook**: `useScreenTransition(screenName, options?)`
- **Metrics Tracked**:
  - Mount time
  - Interactive time
  - Transition count
- **Features**:
  - React Navigation integration
  - Slow transition warnings (>500ms)
  - Automatic telemetry reporting

### 4. FPS Monitoring
- **Hook**: `useFPSMonitor(options?)`
- **Availability**: Development builds only (`__DEV__`)
- **Features**:
  - Frame rate tracking via `requestAnimationFrame`
  - Low FPS detection (configurable threshold, default: 30)
  - Stats: current, min, max, avg FPS, low FPS count
  - Periodic logging (default: 5s intervals)
  - `useSimpleFPS()` convenience export for simple FPS readout

### 5. Screen Telemetry
- **Hook**: `useScreenTelemetry(screenName, getProperties, isReady?)`
- **Features**:
  - One-time screen view tracking via `Telemetry.trackScreen()`
  - Ref guard prevents re-firing on data changes
  - Optional `isReady` gate to defer until interactive
  - Properties function called lazily via `setTimeout` so refs can be read

### 6. Filter Transition
- **Hook**: `useFilterTransition(options)`
- **Features**:
  - Non-blocking filter state transitions via React 18's `useTransition`
  - `isPending` flag for loading indicators
  - Auto-applies filter when items or filterFn change
  - Extended variant `useFilterTransitionWithDeps` for additional dependency tracking

### 7. Deferred Search
- **Hook**: `useDeferredSearch(options)`
- **Features**:
  - Responsive search-as-you-type via a 150 ms DEBOUNCE — deliberately not
    `useDeferredValue`, whose interruptible render breaks FlashList
  - `isStale` flag when query changed but results haven't caught up
  - Configurable minimum query length
  - Extended variant `useDeferredSearchWithSort` for combined search + sort

### 8. Deferred Callback
- **Hook**: `useDeferredCallback(callback, enabled?, timeout?)`
- **Features**:
  - Defers background work execution via `setTimeout` (default: 1000ms)
  - Ensures work runs after startup hot zone
  - `enabled` gate to conditionally run

### 9. Deferred Render
- **Hook**: `useDeferredRender(delay?)`
- **Features**:
  - Returns `false` initially, transitions to `true` when React's concurrent scheduler is idle
  - Uses `useDeferredValue` with initial value — replaces `requestIdleCallback` (iOS reliability issues)
  - Ideal for gating heavy renders behind skeleton placeholders

### 10. After Interaction
- **Hook**: `useAfterInteraction(callback, options?)`
- **Features**:
  - Runs callback via `requestIdleCallback()` after navigation animations settle
  - Ensures heavy work doesn't interfere with navigation transitions
  - `enabled` gate option

### 11. Performance Dashboard
- **Location**: Profile → Performance Dashboard (from profile settings list)
- **Availability**: Development builds only (`__DEV__`)
- **Views**:
  - Slowest Components table
  - Slowest Screen Transitions table
  - Recent Memory Snapshots list
  - Clear data functionality

## Architecture

### Data Flow

```
Component/Screen
    ↓
Performance Hook (useRenderTime, useScreenTransition, useMemoryMonitor, etc.)
    ↓
Telemetry Service (metrics reporting)
    ↓
Performance Store (isolated Zustand store — separate from main app store)
    ↓
Performance Dashboard (UI)
```

### File Structure

```
src/
├── services/
│   └── performance/
│       ├── types.ts              # Type definitions
│       ├── MemoryMonitor.ts      # Memory monitoring service
│       └── NativePerformanceService.ts # Central observer (startup, measures, HTTP)
├── hooks/
│   └── performance/
│       ├── useRenderTime.ts      # Component render tracking
│       ├── useMemoryMonitor.ts   # Memory usage tracking
│       ├── useScreenTransition.ts # Screen navigation tracking
│       ├── useFPSMonitor.ts      # Frame rate monitoring (DEV only)
│       ├── useScreenTelemetry.ts # One-time screen view tracking
│       ├── useFilterTransition.ts # Non-blocking filter transitions
│       ├── useDeferredSearch.ts  # Responsive search (debounced, NOT deferred)
│       ├── useDeferredCallback.ts # Deferred background work execution
│       ├── useDeferredRender.ts  # Deferred render until idle
│       └── useAfterInteraction.ts # Run callback via requestIdleCallback
├── store/
│   ├── performanceStore.ts       # Isolated performance Zustand store
│   └── slices/
│       └── performanceSlice.ts   # Performance state management
└── screens/
    └── profile/
        └── PerformanceDashboard.tsx # Dashboard UI
```

## Implementation Details

### Types (`src/services/performance/types.ts`)

```typescript
interface RenderMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  avgRenderTime: number;
  maxRenderTime: number;
  totalRenderTime: number;
  lastRenderTimestamp: number;
}

interface ScreenMetrics {
  screenName: string;
  transitionCount: number;
  lastMountTime: number;
  lastInteractiveTime: number;
  avgMountTime: number;
  avgInteractiveTime: number;
  maxMountTime: number;
  maxInteractiveTime: number;
  totalMountTime: number;
  totalInteractiveTime: number;
  lastTransitionTimestamp: number;
}

interface MemorySnapshot {
  timestamp: number;
  usedBytes: number;
  limitBytes?: number;
  usagePercent: number;
  context?: string;
}

interface PerformanceConfig {
  enabled: boolean;
  trackRenders: boolean;
  trackMemory: boolean;
  trackScreens: boolean;
  sampleRate: number;
  slowRenderThreshold: number;
  memoryWarningThreshold: number;
  maxMemorySnapshots: number;
}
```

### Configuration Defaults

```typescript
const DEFAULT_PERFORMANCE_CONFIG = {
  enabled: true,          // Enabled in all environments — telemetry pipeline handles routing
  trackRenders: true,     // Track component renders (sampled in production)
  trackMemory: false,     // Disabled — RN memory APIs are unreliable
  trackScreens: true,     // Track screen transitions in all environments
  sampleRate: __DEV__ ? 1.0 : 0.2,  // 100% in dev, 20% in release
  slowRenderThreshold: __DEV__ ? 500 : 16,  // Android emulator adds 5-10x overhead; 16ms = 60fps for production
  memoryWarningThreshold: 80, // Warn at 80% memory usage
  maxMemorySnapshots: 100,    // Keep last 100 snapshots
};
```

### 12. Native Performance Service
- **Service**: `NativePerformanceService` (singleton)
- **Library**: `react-native-performance` v6
- **Metrics Reported**:
  - `app_native_launch_ms` — Native platform initialization time
  - `app_js_bundle_load_ms` — Hermes bytecode load/parse time
  - `app_content_appeared_ms` — Time from process start to first content visible
  - `http_request_duration_ms` — HTTP request duration by host (auto-captured)
- **Features**:
  - Three `PerformanceObserver` instances (native marks, measures, resources)
  - Buffered observation captures marks emitted before JS runs
  - Central routing: `useScreenTransition` creates marks/measures, observer routes to telemetry
  - GraphQL endpoint filtered from HTTP metrics to avoid double-counting
  - Resource logging enabled via `setResourceLoggingEnabled(true)`

## Usage Examples

### 1. Track Screen Performance

```typescript
import { useScreenTransition } from '#hooks/performance';

export const MyScreen: React.FC = () => {
  // Automatically tracks mount and interactive time
  useScreenTransition('MyScreen');

  return <View>...</View>;
};
```

### 2. Track Component Renders

```typescript
import { useRenderTime } from '#hooks/performance';

export const MyComponent: React.FC = () => {
  // Track render performance with custom options
  useRenderTime('MyComponent', {
    enabled: __DEV__,
    sampleRate: 1.0,
    slowThreshold: 16,
  });

  return <View>...</View>;
};
```

### 3. Monitor Component Memory

```typescript
import { useMemoryMonitor } from '#hooks/performance';

export const ImageHeavyComponent: React.FC = () => {
  // Track memory usage on mount/unmount
  useMemoryMonitor('ImageHeavyComponent', {
    enabled: __DEV__,
    trackMount: true,
    trackUnmount: true,
  });

  return <View>...</View>;
};
```

### 4. Access Performance Data

```typescript
import { usePerformanceStore } from '#/store/performanceStore';

const MyComponent = () => {
  const getSlowestComponents = usePerformanceStore(state => state.getSlowestComponents);
  const getSlowestScreens = usePerformanceStore(state => state.getSlowestScreens);
  const getRecentMemorySnapshots = usePerformanceStore(state => state.getRecentMemorySnapshots);

  const slowComponents = getSlowestComponents(10);
  const slowScreens = getSlowestScreens(10);
  const memorySnapshots = getRecentMemorySnapshots(20);

  // Use the data...
};
```

## Integration Points

### Current Integrations

**Screens using `useScreenTransition`:**

- **Pantry:** PantryMain, PantryItemDetail
- **Shopping List:** ShoppingListMain, ItemDetail
- **Recipe:** RecipeMain, RecipeSearch, RecipeDetail
- **Home:** HomeManagement, HomeDetailScreen, StorageLocationsScreen
- **Onboarding:** BiometricSetupScreen, InviteMemberScreen, OnboardingCompleteScreen, ProfilePictureUploadScreen, CreateShoppingListScreen, CreateHomeScreen, SelectPantryItems
- **Profile:** ProfileScreen
- **Notifications:** NotificationListScreen

**Other integrations:**

1. **App.tsx** — NativePerformanceService initialized after Telemetry (startup marks, HTTP timing, measure routing)
2. **App.tsx** — MemoryMonitor started on app initialization (10s sampling)
2. **ProfileScreen** (src/screens/profile/ProfileScreen.tsx:143) — navigates to `PerformanceDashboard` from the profile settings list
3. **RootNavigator** (src/navigation/RootNavigator.tsx) — PerformanceDashboard route registered

### Telemetry Metrics

All performance data is reported to the Telemetry system:

**Counters:**
- `component_render_count` - Commits per component (re-render churn)
- `slow_screen_transitions_total` - Count of slow transitions
- `app_memory_warnings_total` - Memory warning events
- `app_memory_critical_total` - Critical memory events

**Histograms:**
- `app_native_launch_ms` - Native platform launch time
- `app_js_bundle_load_ms` - JS bundle load time
- `app_content_appeared_ms` - Time to first content visible
- `http_request_duration_ms` - HTTP request duration by host
- `component_commit_gap_ms` - Distribution of wall time between a component's
  consecutive commits. NOT render cost (includes idle time): React's
  `<Profiler onRender>` would give true `actualDuration`, but
  `ReactFabric-prod.js` strips `onRender`, so it cannot report from a release
  build. Use `component_render_count` for re-render churn.
- `screen_mount_duration_ms` - Screen mount time distribution
- `screen_interactive_duration_ms` - Time to interactive distribution
- `screen_transition_duration_ms` - Total transition time distribution

**Gauges:**
- `app_memory_used_bytes` - Current memory usage
- `app_memory_limit_bytes` - Memory limit
- `app_memory_usage_percent` - Memory usage percentage

## Performance Considerations

### Minimal Overhead

1. **Sampling**: Only 20% of commits tracked in release builds, and per-cell
   FlashList instrumentation only 5% of sessions — the latter because the
   wrapper costs ~30-60 ms of a ~320 ms first-layout window, so it is a
   measurement-accuracy guard, not a volume knob. Do not raise it.
2. **Selective Tracking**: Render and screen tracking enabled in all environments; memory tracking disabled
3. **Efficient Storage**: Limited retention (50 components, 30 screens, 100 snapshots)
4. **No Re-renders**: Uses `useRef` to avoid triggering component re-renders

### Memory Management

1. **Automatic Trimming**: Old metrics automatically removed
2. **No Persistence**: Performance data not saved to storage
3. **Production Safe**: Tracking enabled with low sample rates; dashboard is DEV-only

## Best Practices

### When to Use Performance Hooks

✅ **Good Use Cases:**
- Main navigation screens (always)
- Complex list components with many items
- Components with expensive calculations
- Image-heavy components
- Components with known performance issues

❌ **Avoid:**
- Simple presentational components
- Components that render very frequently (animations)

Do not avoid release builds: these metrics are available in all builds and
routed to OTLP because release is where the numbers are valid. Debug is for
attribution only.

### Performance Thresholds

- **Render Time**: Target <16ms (60fps)
- **Screen Transition**: Target <500ms
- **Memory Growth**: Warning if >10MB not released on unmount

## Troubleshooting

### Common Issues

**1. No data in Performance Dashboard**
- Ensure you're in development mode (`__DEV__` is true)
- Navigate through the app to generate metrics
- Check that performance tracking is enabled in settings

**2. Performance overhead**
- Reduce sample rate in configuration
- Disable tracking for non-critical components
- Consider release mode, where commit sampling is 20%

**3. Memory measurements inaccurate**
- React Native has limited memory APIs
- Fallback estimates used on some platforms
- Focus on relative changes, not absolute values

## Future Enhancements

### Potential Improvements

1. **Performance Budgets**: Set thresholds and alerts
2. **Automated Reports**: Export performance data
3. **Component-Level Memory**: More granular memory tracking
4. **Network Performance**: Track GraphQL query times
5. **User Settings**: Enable/disable tracking per feature
6. **Historical Data**: Persist metrics across sessions
7. **Flame Graphs**: Visual render tree analysis

## Testing

### Manual Testing Checklist

- [ ] Navigate to Profile → Performance Dashboard
- [ ] Navigate to PantryMain - verify metrics appear
- [ ] Navigate to ShoppingListMain - verify metrics appear
- [ ] Navigate to RecipeSearch - verify metrics appear
- [ ] Check memory snapshots update every 10s
- [ ] Verify slow component warnings in console
- [ ] Test "Clear Performance Data" button
- [ ] Verify dashboard shows empty state when no data

## Measurement protocol

CLAUDE.md § Performance measurement holds each rule as one line; this is the
reading behind each. Measurement decides what to change; it is not the
confirmation step. A check that names no build, no device and no sample size
turns an emulator reading into a conclusion about hardware. Audit write-ups are
scratch and untracked (`.gitignore`), so every number a rule rests on lives here.

**A mechanism is not a cause.** Confirming in library source HOW something works
says nothing about its SHARE of the time. Measure the share first.

**Read a metric's definition before reasoning from its name.** The contract table
is `docs/telemetry-setup.md` § Metric Reference, kept complete by
`__tests__/telemetry/metricContracts.test.ts`. `app_js_entry_to_store_ready_ms`
spans JS entry → rehydrate, a module-evaluation window; the hydration inside it is
~5 ms, so a name reading as "hydration" sends a whole optimisation pass after
those 5 ms.

**Numbers come from a release build; attribution may come from debug — never mix
them in one comparison.** A debug build overstates mount and append cost. In a
debug bundle the FIRST heavy `require` after a timing mark absorbs ~200 ms that
belongs to no module: move an unrelated import in front of it and the cost
follows the position, not the module. `localRelease` is the measuring build
(`docs/development.md` § Android variants).

**Emulator numbers understate hardware; re-measure on a device before acting.**
`flashlist_initial_load_ms` for the same screen: 40 ms on the Pixel_9a emulator,
301–934 ms on an SM-S908U1. Emulator frame stats cannot be used at all: its
software GPU alone takes 16–20 ms per frame.

**An iOS simulator OVERSTATES.** It does not emulate a CPU; it runs arm64 natively
on the Mac's cores, so an iOS-sim number beside an Android-device number compares
two host machines, not two platforms. Compare iOS to iOS, build over build. iOS
has no OS-side fully-drawn marker (no API accepts an app-declared signal), so the
two-method agreement that backs `app_fully_drawn_ms` on Android does not carry
over; `scripts/ios-frame-sample.mjs` is the only cross-check.

**A startup metric is bounded, and the drop is counted.** `app_fully_drawn_ms`
latches on the first instrumented list showing real content, and `HomeTabs` is
lazy — only the Pantry tab mounts at cold start, so the other two lists can only
latch after a navigation. Past `STARTUP_WINDOW_MS` (10 s,
`src/services/performance/startupProfiling.ts`, shared with the profiler's own
fallback) nothing is emitted and `startup_window_exceeded_total` increments, so an
EXCLUDED launch stays distinguishable from an unmeasured one. The bound is not
defended by argument: a non-trivial rate on that counter is the evidence for
changing it.

**A terminating condition reads the UN-SMOOTHED signal.** The pantry's skeletons
pass through a 280 ms `useMinimumVisible` anti-flicker hold; a latch reading it
puts the hold under `app_fully_drawn_ms` as a floor, so any improvement below
280 ms is structurally unmeasurable — the same defect as reading a
threshold-gated `slow_*_total`. Measurement takes `initialSkeletons`, presentation
keeps `showSkeletons`. Every `app_fully_drawn_ms` figure recorded before
2026-08-26 is invalid: it predates both this fix and the profiler-suppression fix.

**State the instrument's resolution.** A difference smaller than one sample is not
a result: the phone's ~450 ms screenshot sampling cannot resolve a 100 ms change
(an iOS simulator's simctl loop samples at ~176 ms —
[verified-library-behaviour.md](verified-library-behaviour.md#simctl-screenshot-sampling-resolves-176-ms-no-finer)),
and a series that returns the same value for two different builds is not
measuring them.

**Run a control before believing an attribution.** Vary something you do NOT
believe in. If the cost follows it, the attribution was positional.

**Never read a performance value from a `slow_*_total` counter's labels.** They
are threshold-gated and structurally cannot show the fast half of the
distribution. Read the `_bucket`/`_sum`/`_count` histogram series.

**Judge an intermittent mode against a distribution, not a handful of samples.**
Per-session counters plus lingering series make cross-session aggregation
(`sum(...) by (screen)`) untrustworthy — read per session.

**Match the instrument to the symptom.** HITCHING (occasional long frames) is a
re-render problem: read React commit counts or
`flashlist_data_reference_changes`. A FRAME-RATE CEILING (every frame uniformly
over budget) is not: read `adb shell dumpsys gfxinfo <pkg> framestats` on a
DEVICE and decompose per phase. On the pantry the UI thread — where per-row view
count and Yoga layout live — is 1.5 ms of a 17 ms frame, so "reduce views per
row" measures out false while React-render reasoning points the same wrong way.
Per-phase table: `docs/flashlist-performance-analysis.md`.

**Check the panel's refresh rate before calling a frame slow.**
`adb shell dumpsys display | grep mActiveModeId` gives the active mode; read its
`vsyncRate`. The SM-S908U1 runs at 96 Hz, so its budget is 10.4 ms, not 16.7 ms.

## References

- [React Performance Profiling](https://react.dev/reference/react/Profiler)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## Changelog

### Doc update (2026-02-22)

Updated documentation to reflect current codebase state:
- Fixed store access pattern (`usePerformanceStore` from isolated store)
- Added 7 missing hook descriptions (useFPSMonitor, useScreenTelemetry, useFilterTransition, useDeferredSearch, useDeferredCallback, useDeferredRender, useAfterInteraction)
- Updated file structure to match actual files (removed nonexistent index.ts barrel files)
- Fixed config defaults (enabled in all envs, trackMemory disabled, slowRenderThreshold varies by env)
- Fixed MemoryMonitor description (uses react-native-device-info, not platform-specific fallbacks)
- Updated integration points to list all 19 screens using useScreenTransition
- Fixed Performance Dashboard navigation path (ProfileScreen, not AppSettingsScreen)

### Session 8 (2025-10-29)

**Added:**
- Performance types and interfaces (types.ts)
- useRenderTime hook for component tracking
- useMemoryMonitor hook for memory tracking
- useScreenTransition hook for screen navigation
- MemoryMonitor singleton service
- performanceSlice for state management
- PerformanceDashboard screen
- Navigation routes for PerformanceDashboard

**Status:** ✅ Complete

## Telemetry Transport

All metrics collected by the performance hooks (render times, screen transitions, memory snapshots) are sent to the configured OTLP backend via `HttpTransport`. For setup instructions, endpoint configuration, and switching between Grafana Cloud and self-hosted backends, see [Telemetry Setup](./telemetry-setup.md).
