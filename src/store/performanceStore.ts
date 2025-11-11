import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { createPerformanceSlice, PerformanceState } from './slices/performanceSlice';

// Enable Immer MapSet plugin for Map data structures in performance metrics
enableMapSet();

/**
 * Separate performance store - isolated from main app store
 *
 * This store is intentionally separated to prevent performance metric updates
 * from triggering re-renders in the main app. Performance tracking should be
 * transparent and have zero impact on app performance.
 *
 * NO middleware except immer:
 * - No subscribeWithSelector (would trigger component re-renders)
 * - No persist (performance data is ephemeral, dev-only)
 */
export const usePerformanceStore = create<PerformanceState>()(
  immer((set, get, store) => createPerformanceSlice(set, get, store)),
);
