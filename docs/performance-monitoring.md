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
>
> The metric list below is also incomplete — `docs/telemetry-setup.md`
> § Metric Reference is the contract, and
> `__tests__/telemetry/metricContracts.test.ts` keeps it complete. For how to
> take a measurement at all, see CLAUDE.md § Performance measurement.

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
  - Configurable sampling rate (default: 100% dev, 10% prod)
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
  - Responsive search-as-you-type with `useDeferredValue`
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
│       ├── useDeferredSearch.ts  # Responsive search with deferred value
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
  sampleRate: __DEV__ ? 1.0 : 0.1,  // 100% in dev, 10% in production
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

1. **Sampling**: Only 10% of renders tracked in production
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

(Note: this list once said to avoid production builds. That contradicts
"Availability: All builds" above and the point of routing these metrics to OTLP —
release is where the numbers are valid. Debug is for attribution only.)

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
- Consider production mode where sampling is 10%

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

### Performance Verification

The protocol — build variant, device, run count, controls, which series to read —
is CLAUDE.md § Performance measurement. The numbers and the retracted readings
behind those rules are in `docs/audits/perf-offline-baseline-2026-08-24.md`.

The four bullets that used to live here ("check console logs", "monitor memory",
"verify transitions under 500ms", "confirm metrics are sent") named no build, no
device and no sample size, which is how an emulator reading became a conclusion
about hardware.

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
