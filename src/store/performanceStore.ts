import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createPerformanceSlice,
  PerformanceState,
} from './slices/performanceSlice';

/**
 * Kept out of the root store so metric writes cannot re-render the app. Immer
 * only: `subscribeWithSelector` would re-render subscribers, and the data is
 * ephemeral so there is nothing to persist. `enableMapSet()` runs in `index.ts`.
 */
export const usePerformanceStore = create<PerformanceState>()(
  immer((set, get, store) => createPerformanceSlice(set, get, store)),
);
