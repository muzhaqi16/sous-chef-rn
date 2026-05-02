import { StateCreator } from 'zustand';
import {
  RenderMetrics,
  ScreenMetrics,
  MemorySnapshot,
  DEFAULT_PERFORMANCE_CONFIG,
} from '#/services/performance/types';

export interface PerformanceState {
  // Configuration
  isEnabled: boolean;
  trackRenders: boolean;
  trackMemory: boolean;
  trackScreens: boolean;

  // Metrics data
  componentMetrics: Map<string, RenderMetrics>;
  screenMetrics: Map<string, ScreenMetrics>;
  memorySnapshots: MemorySnapshot[];

  // Actions
  setPerformanceEnabled: (enabled: boolean) => void;
  setTrackRenders: (enabled: boolean) => void;
  setTrackMemory: (enabled: boolean) => void;
  setTrackScreens: (enabled: boolean) => void;

  // Record metrics
  recordComponentRender: (componentName: string, renderTime: number) => void;
  recordScreenTransition: (
    screenName: string,
    mountTime: number,
    interactiveTime: number,
  ) => void;
  addMemorySnapshot: (snapshot: MemorySnapshot) => void;

  // Selectors
  getSlowestComponents: (limit?: number) => RenderMetrics[];
  getSlowestScreens: (limit?: number) => ScreenMetrics[];
  getRecentMemorySnapshots: (limit?: number) => MemorySnapshot[];
  getComponentMetrics: (componentName: string) => RenderMetrics | undefined;
  getScreenMetrics: (screenName: string) => ScreenMetrics | undefined;

  // Utility
  clearPerformanceData: () => void;
  reset: () => void;
}

export const initialPerformanceState = {
  isEnabled: DEFAULT_PERFORMANCE_CONFIG.enabled,
  trackRenders: DEFAULT_PERFORMANCE_CONFIG.trackRenders,
  trackMemory: DEFAULT_PERFORMANCE_CONFIG.trackMemory,
  trackScreens: DEFAULT_PERFORMANCE_CONFIG.trackScreens,
  componentMetrics: new Map<string, RenderMetrics>(),
  screenMetrics: new Map<string, ScreenMetrics>(),
  memorySnapshots: [] as MemorySnapshot[],
};

const MAX_COMPONENTS = 50;
const MAX_SCREENS = 30;
const MAX_MEMORY_SNAPSHOTS = 100;

export const createPerformanceSlice: StateCreator<
  PerformanceState,
  [['zustand/immer', never]],
  [],
  PerformanceState
> = (set, get) => ({
  ...initialPerformanceState,

  setPerformanceEnabled: (enabled: boolean) =>
    set(state => {
      state.isEnabled = enabled;
      if (!enabled) {
        state.trackRenders = false;
        state.trackMemory = false;
        state.trackScreens = false;
      }
    }),

  setTrackRenders: (enabled: boolean) =>
    set(state => {
      state.trackRenders = enabled;
    }),

  setTrackMemory: (enabled: boolean) =>
    set(state => {
      state.trackMemory = enabled;
    }),

  setTrackScreens: (enabled: boolean) =>
    set(state => {
      state.trackScreens = enabled;
    }),

  recordComponentRender: (componentName: string, renderTime: number) =>
    set(state => {
      if (!state.isEnabled || !state.trackRenders) {
        return;
      }

      const existing = state.componentMetrics.get(componentName);
      const now = Date.now();

      if (existing) {
        // Update existing metrics
        existing.renderCount += 1;
        existing.lastRenderTime = renderTime;
        existing.totalRenderTime += renderTime;
        existing.avgRenderTime =
          existing.totalRenderTime / existing.renderCount;
        existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
        existing.lastRenderTimestamp = now;
      } else {
        // Create new metrics
        const newMetrics: RenderMetrics = {
          componentName,
          renderCount: 1,
          lastRenderTime: renderTime,
          avgRenderTime: renderTime,
          maxRenderTime: renderTime,
          totalRenderTime: renderTime,
          lastRenderTimestamp: now,
        };
        state.componentMetrics.set(componentName, newMetrics);

        // Trim if too many components
        if (state.componentMetrics.size > MAX_COMPONENTS) {
          // Remove oldest (by last render timestamp)
          let oldestKey: string | null = null;
          let oldestTime = Infinity;

          state.componentMetrics.forEach((metrics, key) => {
            if (metrics.lastRenderTimestamp < oldestTime) {
              oldestTime = metrics.lastRenderTimestamp;
              oldestKey = key;
            }
          });

          if (oldestKey) {
            state.componentMetrics.delete(oldestKey);
          }
        }
      }
    }),

  recordScreenTransition: (
    screenName: string,
    mountTime: number,
    interactiveTime: number,
  ) =>
    set(state => {
      if (!state.isEnabled || !state.trackScreens) {
        return;
      }

      const existing = state.screenMetrics.get(screenName);
      const now = Date.now();

      if (existing) {
        // Update existing metrics
        existing.transitionCount += 1;
        existing.lastMountTime = mountTime;
        existing.lastInteractiveTime = interactiveTime;
        existing.totalMountTime += mountTime;
        existing.totalInteractiveTime += interactiveTime;
        existing.avgMountTime =
          existing.totalMountTime / existing.transitionCount;
        existing.avgInteractiveTime =
          existing.totalInteractiveTime / existing.transitionCount;
        existing.maxMountTime = Math.max(existing.maxMountTime, mountTime);
        existing.maxInteractiveTime = Math.max(
          existing.maxInteractiveTime,
          interactiveTime,
        );
        existing.lastTransitionTimestamp = now;
      } else {
        // Create new metrics
        const newMetrics: ScreenMetrics = {
          screenName,
          transitionCount: 1,
          lastMountTime: mountTime,
          lastInteractiveTime: interactiveTime,
          avgMountTime: mountTime,
          avgInteractiveTime: interactiveTime,
          maxMountTime: mountTime,
          maxInteractiveTime: interactiveTime,
          totalMountTime: mountTime,
          totalInteractiveTime: interactiveTime,
          lastTransitionTimestamp: now,
        };
        state.screenMetrics.set(screenName, newMetrics);

        // Trim if too many screens
        if (state.screenMetrics.size > MAX_SCREENS) {
          // Remove oldest (by last transition timestamp)
          let oldestKey: string | null = null;
          let oldestTime = Infinity;

          state.screenMetrics.forEach((metrics, key) => {
            if (metrics.lastTransitionTimestamp < oldestTime) {
              oldestTime = metrics.lastTransitionTimestamp;
              oldestKey = key;
            }
          });

          if (oldestKey) {
            state.screenMetrics.delete(oldestKey);
          }
        }
      }
    }),

  addMemorySnapshot: (snapshot: MemorySnapshot) =>
    set(state => {
      if (!state.isEnabled || !state.trackMemory) {
        return;
      }

      state.memorySnapshots.push(snapshot);

      // Trim if too many snapshots
      if (state.memorySnapshots.length > MAX_MEMORY_SNAPSHOTS) {
        state.memorySnapshots = state.memorySnapshots.slice(
          -MAX_MEMORY_SNAPSHOTS,
        );
      }
    }),

  getSlowestComponents: (limit = 10): RenderMetrics[] => {
    const state = get();
    return Array.from(state.componentMetrics.values())
      .sort((a, b) => b.avgRenderTime - a.avgRenderTime)
      .slice(0, limit);
  },

  getSlowestScreens: (limit = 10): ScreenMetrics[] => {
    const state = get();
    return Array.from(state.screenMetrics.values())
      .sort((a, b) => b.avgInteractiveTime - a.avgInteractiveTime)
      .slice(0, limit);
  },

  getRecentMemorySnapshots: (limit = 20): MemorySnapshot[] => {
    const state = get();
    return state.memorySnapshots.slice(-limit);
  },

  getComponentMetrics: (componentName: string): RenderMetrics | undefined => {
    const state = get();
    return state.componentMetrics.get(componentName);
  },

  getScreenMetrics: (screenName: string): ScreenMetrics | undefined => {
    const state = get();
    return state.screenMetrics.get(screenName);
  },

  clearPerformanceData: () =>
    set(state => {
      state.componentMetrics = new Map();
      state.screenMetrics = new Map();
      state.memorySnapshots = [];
    }),

  reset: () =>
    set({
      ...initialPerformanceState,
      componentMetrics: new Map(),
      screenMetrics: new Map(),
      memorySnapshots: [],
    }),
});
