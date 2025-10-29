# Phase 2: Performance Monitoring Implementation

## Overview

This document describes the performance monitoring infrastructure added to the Sous Chef React Native application. This system allows developers to track component render times, memory usage, and screen transition performance.

## Features

### 1. Component Render Tracking
- **Hook**: `useRenderTime(componentName, options?)`
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
  - Platform-specific APIs with fallbacks

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

### 4. Performance Dashboard
- **Location**: Profile → App Settings → Developer → Performance Dashboard
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
Performance Hook (useRenderTime, useScreenTransition, useMemoryMonitor)
    ↓
Telemetry Service (metrics reporting)
    ↓
Performance Slice (Zustand state management)
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
│       └── index.ts
├── hooks/
│   └── performance/
│       ├── useRenderTime.ts      # Component render tracking
│       ├── useMemoryMonitor.ts   # Memory usage tracking
│       ├── useScreenTransition.ts # Screen navigation tracking
│       └── index.ts
├── store/
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
  enabled: __DEV__,
  trackRenders: true,
  trackMemory: true,
  trackScreens: true,
  sampleRate: __DEV__ ? 1.0 : 0.1,
  slowRenderThreshold: 16, // 60fps
  memoryWarningThreshold: 80, // percentage
  maxMemorySnapshots: 100,
};
```

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
import { useStore } from '#/store';

const MyComponent = () => {
  const getSlowestComponents = useStore(state => state.getSlowestComponents);
  const getSlowestScreens = useStore(state => state.getSlowestScreens);
  const getRecentMemorySnapshots = useStore(state => state.getRecentMemorySnapshots);

  const slowComponents = getSlowestComponents(10);
  const slowScreens = getSlowestScreens(10);
  const memorySnapshots = getRecentMemorySnapshots(20);

  // Use the data...
};
```

## Integration Points

### Current Integrations

1. **App.tsx** (App.tsx:17,59-75)
   - MemoryMonitor started on app initialization
   - Samples every 10 seconds in development

2. **PantryMain** (src/screens/pantry/PantryMain.tsx:7,78)
   - Screen transition tracking enabled

3. **ShoppingListMain** (src/screens/shoppingList/ShoppingListMain.tsx:51,167)
   - Screen transition tracking enabled

4. **RecipeSearch** (src/screens/recipe/RecipeSearch.tsx:30,80)
   - Screen transition tracking enabled

5. **AppSettingsScreen** (src/screens/profile/AppSettingsScreen.tsx:168-177)
   - Link to Performance Dashboard (dev only)

6. **RootNavigator** (src/navigation/RootNavigator.tsx:32,64,202)
   - PerformanceDashboard route registered

### Telemetry Metrics

All performance data is reported to the Telemetry system:

**Counters:**
- `component_render_count` - Total renders per component
- `slow_component_renders_total` - Count of slow renders
- `slow_screen_transitions_total` - Count of slow transitions
- `app_memory_warnings_total` - Memory warning events
- `app_memory_critical_total` - Critical memory events

**Histograms:**
- `component_render_duration_ms` - Render time distribution
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
2. **Conditional Execution**: Most tracking disabled in production builds
3. **Efficient Storage**: Limited retention (50 components, 30 screens, 100 snapshots)
4. **No Re-renders**: Uses `useRef` to avoid triggering component re-renders

### Memory Management

1. **Automatic Trimming**: Old metrics automatically removed
2. **No Persistence**: Performance data not saved to storage
3. **Development Only**: Most features disabled in production

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
- Production builds (unless specific issue investigation)

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

- [ ] Navigate to Profile → App Settings → Developer section visible
- [ ] Open Performance Dashboard
- [ ] Navigate to PantryMain - verify metrics appear
- [ ] Navigate to ShoppingListMain - verify metrics appear
- [ ] Navigate to RecipeSearch - verify metrics appear
- [ ] Check memory snapshots update every 10s
- [ ] Verify slow component warnings in console
- [ ] Test "Clear Performance Data" button
- [ ] Verify dashboard shows empty state when no data

### Performance Verification

1. Check console logs for slow render warnings
2. Monitor memory usage over time
3. Verify screen transitions under 500ms
4. Confirm telemetry metrics are being sent

## References

- [React Performance Profiling](https://react.dev/reference/react/Profiler)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## Changelog

### Session 8 (2025-10-29)

**Added:**
- Performance types and interfaces (types.ts)
- useRenderTime hook for component tracking
- useMemoryMonitor hook for memory tracking
- useScreenTransition hook for screen navigation
- MemoryMonitor singleton service
- performanceSlice for state management
- PerformanceDashboard screen
- Integration in PantryMain, ShoppingListMain, RecipeSearch
- Memory monitoring in App.tsx
- Developer section in AppSettingsScreen
- Navigation routes for PerformanceDashboard

**Configuration:**
- Default config: enabled in dev, 10% sampling in prod
- Thresholds: 16ms renders, 500ms transitions, 80% memory
- Limits: 50 components, 30 screens, 100 memory snapshots

**Status:** ✅ Complete (100%)
