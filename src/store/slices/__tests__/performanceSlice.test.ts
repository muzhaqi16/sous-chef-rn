import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { createPerformanceSlice, PerformanceState } from '../performanceSlice';

enableMapSet();

function createPerfStore(overrides?: Partial<PerformanceState>) {
  const store = create<PerformanceState>()(
    immer((set, get, api) => ({
      ...createPerformanceSlice(set, get, api),
    })),
  );
  if (overrides) {
    store.setState(overrides);
  }
  return store;
}

describe('performanceSlice', () => {
  it('initializes with default values', () => {
    const store = createPerfStore();
    const state = store.getState();
    expect(state.componentMetrics.size).toBe(0);
    expect(state.screenMetrics.size).toBe(0);
    expect(state.memorySnapshots).toEqual([]);
  });

  describe('setPerformanceEnabled', () => {
    it('enables performance tracking', () => {
      const store = createPerfStore({ isEnabled: false });
      store.getState().setPerformanceEnabled(true);
      expect(store.getState().isEnabled).toBe(true);
    });

    it('disabling turns off all sub-tracking', () => {
      const store = createPerfStore({
        isEnabled: true,
        trackRenders: true,
        trackMemory: true,
        trackScreens: true,
      });
      store.getState().setPerformanceEnabled(false);
      expect(store.getState().trackRenders).toBe(false);
      expect(store.getState().trackMemory).toBe(false);
      expect(store.getState().trackScreens).toBe(false);
    });
  });

  describe('setTrackRenders', () => {
    it('toggles render tracking', () => {
      const store = createPerfStore({ trackRenders: false });
      store.getState().setTrackRenders(true);
      expect(store.getState().trackRenders).toBe(true);
    });
  });

  describe('recordComponentRender', () => {
    it('records a new component render', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: true });
      store.getState().recordComponentRender('Button', 5);
      const metrics = store.getState().componentMetrics.get('Button');
      expect(metrics).toBeDefined();
      expect(metrics!.renderCount).toBe(1);
      expect(metrics!.lastRenderTime).toBe(5);
      expect(metrics!.avgRenderTime).toBe(5);
      expect(metrics!.maxRenderTime).toBe(5);
    });

    it('updates existing component metrics', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: true });
      store.getState().recordComponentRender('Button', 5);
      store.getState().recordComponentRender('Button', 15);
      const metrics = store.getState().componentMetrics.get('Button');
      expect(metrics!.renderCount).toBe(2);
      expect(metrics!.lastRenderTime).toBe(15);
      expect(metrics!.avgRenderTime).toBe(10);
      expect(metrics!.maxRenderTime).toBe(15);
    });

    it('does nothing when disabled', () => {
      const store = createPerfStore({ isEnabled: false });
      store.getState().recordComponentRender('Button', 5);
      expect(store.getState().componentMetrics.size).toBe(0);
    });

    it('does nothing when trackRenders is false', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: false });
      store.getState().recordComponentRender('Button', 5);
      expect(store.getState().componentMetrics.size).toBe(0);
    });
  });

  describe('recordScreenTransition', () => {
    it('records a new screen transition', () => {
      const store = createPerfStore({ isEnabled: true, trackScreens: true });
      store.getState().recordScreenTransition('Home', 100, 200);
      const metrics = store.getState().screenMetrics.get('Home');
      expect(metrics).toBeDefined();
      expect(metrics!.transitionCount).toBe(1);
      expect(metrics!.lastMountTime).toBe(100);
      expect(metrics!.lastInteractiveTime).toBe(200);
    });

    it('updates existing screen metrics', () => {
      const store = createPerfStore({ isEnabled: true, trackScreens: true });
      store.getState().recordScreenTransition('Home', 100, 200);
      store.getState().recordScreenTransition('Home', 150, 250);
      const metrics = store.getState().screenMetrics.get('Home');
      expect(metrics!.transitionCount).toBe(2);
      expect(metrics!.avgMountTime).toBe(125);
      expect(metrics!.maxMountTime).toBe(150);
      expect(metrics!.maxInteractiveTime).toBe(250);
    });

    it('does nothing when disabled', () => {
      const store = createPerfStore({ isEnabled: false });
      store.getState().recordScreenTransition('Home', 100, 200);
      expect(store.getState().screenMetrics.size).toBe(0);
    });
  });

  describe('addMemorySnapshot', () => {
    it('adds a memory snapshot', () => {
      const store = createPerfStore({ isEnabled: true, trackMemory: true });
      store.getState().addMemorySnapshot({
        timestamp: Date.now(),
        usedBytes: 1000000,
        usagePercent: 50,
      });
      expect(store.getState().memorySnapshots).toHaveLength(1);
    });

    it('does nothing when disabled', () => {
      const store = createPerfStore({ isEnabled: false });
      store.getState().addMemorySnapshot({
        timestamp: Date.now(),
        usedBytes: 1000000,
        usagePercent: 50,
      });
      expect(store.getState().memorySnapshots).toHaveLength(0);
    });

    it('trims snapshots when exceeding max', () => {
      const store = createPerfStore({ isEnabled: true, trackMemory: true });
      for (let i = 0; i < 105; i++) {
        store.getState().addMemorySnapshot({
          timestamp: i,
          usedBytes: i * 1000,
          usagePercent: i,
        });
      }
      expect(store.getState().memorySnapshots.length).toBeLessThanOrEqual(100);
    });
  });

  describe('selectors', () => {
    it('getSlowestComponents returns sorted components', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: true });
      store.getState().recordComponentRender('Fast', 2);
      store.getState().recordComponentRender('Slow', 20);
      store.getState().recordComponentRender('Medium', 10);
      const slowest = store.getState().getSlowestComponents(2);
      expect(slowest).toHaveLength(2);
      expect(slowest[0].componentName).toBe('Slow');
    });

    it('getSlowestScreens returns sorted screens', () => {
      const store = createPerfStore({ isEnabled: true, trackScreens: true });
      store.getState().recordScreenTransition('Fast', 50, 100);
      store.getState().recordScreenTransition('Slow', 50, 500);
      const slowest = store.getState().getSlowestScreens(1);
      expect(slowest[0].screenName).toBe('Slow');
    });

    it('getRecentMemorySnapshots returns latest', () => {
      const store = createPerfStore({ isEnabled: true, trackMemory: true });
      for (let i = 0; i < 5; i++) {
        store.getState().addMemorySnapshot({
          timestamp: i,
          usedBytes: i,
          usagePercent: i,
        });
      }
      const recent = store.getState().getRecentMemorySnapshots(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].timestamp).toBe(2);
    });

    it('getComponentMetrics returns specific component', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: true });
      store.getState().recordComponentRender('Button', 5);
      expect(store.getState().getComponentMetrics('Button')).toBeDefined();
      expect(store.getState().getComponentMetrics('Unknown')).toBeUndefined();
    });

    it('getScreenMetrics returns specific screen', () => {
      const store = createPerfStore({ isEnabled: true, trackScreens: true });
      store.getState().recordScreenTransition('Home', 100, 200);
      expect(store.getState().getScreenMetrics('Home')).toBeDefined();
      expect(store.getState().getScreenMetrics('Unknown')).toBeUndefined();
    });
  });

  describe('clearPerformanceData', () => {
    it('clears all metrics', () => {
      const store = createPerfStore({
        isEnabled: true,
        trackRenders: true,
        trackScreens: true,
        trackMemory: true,
      });
      store.getState().recordComponentRender('Button', 5);
      store.getState().recordScreenTransition('Home', 100, 200);
      store
        .getState()
        .addMemorySnapshot({ timestamp: 1, usedBytes: 1, usagePercent: 1 });
      store.getState().clearPerformanceData();
      expect(store.getState().componentMetrics.size).toBe(0);
      expect(store.getState().screenMetrics.size).toBe(0);
      expect(store.getState().memorySnapshots).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      const store = createPerfStore({ isEnabled: true, trackRenders: true });
      store.getState().recordComponentRender('Button', 5);
      store.getState().reset();
      expect(store.getState().componentMetrics.size).toBe(0);
    });
  });
});
